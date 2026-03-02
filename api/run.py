from flask import Blueprint, jsonify, Flask
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_http_middleware import MiddlewareManager, BaseHTTPMiddleware

from db.database import transactional
from db.query import query
from encoder import CustomJSONEncoder


class TransactionalMiddleware(BaseHTTPMiddleware):
    def __init__(self):
        super().__init__()

    @transactional
    def dispatch(self, request, call_next):
        return call_next(request)


class CustomJSONProvider(DefaultJSONProvider):
    def default(self, o):
        encoder = CustomJSONEncoder()
        return encoder.default(o)


# Create blueprint
api_v1 = Blueprint('api_v1', 'api_v1', url_prefix='/api/v1')


# Define routes on blueprint BEFORE registering it
@api_v1.route('/hello', methods=['GET'])
def api_hello():
    return jsonify({'message': 'hello'})


@api_v1.route('/workflow', methods=['GET'])
def list_workflows():
    workflows = query('SELECT * FROM workflow ORDER BY name')
    return jsonify(workflows)


@api_v1.route('/workflow/<id>', methods=['GET'])
def get_workflow(id):
    workflows = query('SELECT * FROM workflow WHERE id = %s', (id,))
    if not workflows:
        return jsonify({'error': 'not found'}), 404

    workflow = workflows[0]

    steps = query(
        'SELECT * FROM workflow_step WHERE workflow_id = %s ORDER BY ordinal',
        (id,)
    )

    options = query(
        '''SELECT wo.* FROM workflow_option wo
           JOIN workflow_step ws ON wo.workflow_step_name = ws.name
           WHERE ws.workflow_id = %s
           ORDER BY wo.ordinal''',
        (id,)
    )

    actions = query(
        '''SELECT wa.*, wota.workflow_option_id FROM workflow_action wa
           JOIN workflow_option_to_action wota ON wa.id = wota.workflow_action_id
           JOIN workflow_option wo ON wota.workflow_option_id = wo.id
           JOIN workflow_step ws ON wo.workflow_step_name = ws.name
           WHERE ws.workflow_id = %s''',
        (id,)
    )

    actions_by_option = {}
    for action in actions:
        opt_id = str(action['workflow_option_id'])
        actions_by_option.setdefault(opt_id, []).append(action)

    options_by_step = {}
    for option in options:
        option['actions'] = actions_by_option.get(str(option['id']), [])
        step_name = option['workflow_step_name']
        options_by_step.setdefault(step_name, []).append(option)

    for step in steps:
        step['options'] = options_by_step.get(step['name'], [])

    workflow['steps'] = steps
    return jsonify(workflow)


# Create app
app = Flask(__name__)
app.json = CustomJSONProvider(app)
app.wsgi_app = MiddlewareManager(app)
app.wsgi_app.add_middleware(TransactionalMiddleware)


# Define app routes
@app.route('/health', methods=['GET'])
def health():
    return 'OK', 200


# Apply CORS to blueprint
CORS(api_v1)

# Register blueprint AFTER routes are defined
app.register_blueprint(api_v1)
