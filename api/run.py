from flask import Blueprint, jsonify, Flask, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_http_middleware import MiddlewareManager, BaseHTTPMiddleware

from db.database import transactional
from db.query import query, execute
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


@api_v1.route('/workflow', methods=['POST'])
def create_workflow():
    body = request.get_json()
    rows = query(
        '''INSERT INTO workflow (name, display_name, description, us_state, type)
           VALUES (%s, %s, %s, %s, %s) RETURNING *''',
        (body['name'], body['display_name'], body.get('description'),
         body.get('us_state'), body.get('type'))
    )
    return jsonify(rows[0]), 201


@api_v1.route('/workflow/<id>/actions', methods=['GET'])
def list_workflow_actions(id):
    workflows = query('SELECT * FROM workflow WHERE id = %s', (id,))
    if not workflows:
        return jsonify({'error': 'not found'}), 404
    workflow_name = workflows[0]['name']
    actions = query(
        '''SELECT * FROM workflow_action
           WHERE workflow_name = %s AND (is_deleted IS NULL OR is_deleted = false)
           ORDER BY name''',
        (workflow_name,)
    )
    return jsonify(actions)


@api_v1.route('/workflow/<id>/save', methods=['POST'])
def save_workflow(id):
    workflows = query('SELECT * FROM workflow WHERE id = %s', (id,))
    if not workflows:
        return jsonify({'error': 'not found'}), 404
    workflow = workflows[0]

    body = request.get_json()

    # 0. Create new steps (must happen before new options, which reference step by name)
    for step in body.get('new_steps', []):
        execute(
            '''INSERT INTO workflow_step (name, display_name, ordinal, workflow_id, workflow_name)
               VALUES (%s, %s, %s, %s, %s)''',
            (step['name'], step['display_name'], step.get('ordinal', 0), id, workflow['name'])
        )

    # 1. Remove action links from existing options
    for link in body.get('remove_action_links', []):
        execute(
            'DELETE FROM workflow_option_to_action WHERE workflow_option_id = %s AND workflow_action_id = %s',
            (link['option_id'], link['action_id'])
        )

    # 2. Remove options (delete their links first, then the option)
    for option_id in body.get('remove_options', []):
        execute('DELETE FROM workflow_option_to_action WHERE workflow_option_id = %s', (option_id,))
        execute('DELETE FROM workflow_option WHERE id = %s', (option_id,))

    # 3. Create new options; track client_id -> real uuid
    option_id_map = {}
    for opt in body.get('new_options', []):
        rows = query(
            '''INSERT INTO workflow_option
               (name, display_name, description, type, ordinal, workflow_step_name, workflow_name)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (opt['name'], opt['display_name'], opt.get('description'),
             opt.get('type', 'button'), opt.get('ordinal', 0), opt['step_name'], workflow['name'])
        )
        option_id_map[opt['client_id']] = str(rows[0]['id'])

    # 4. Create new action records; track client_id -> real uuid
    action_id_map = {}
    for act in body.get('new_actions', []):
        rows = query(
            '''INSERT INTO workflow_action
               (name, description, next_workflow_step_name, action_type, workflow_name)
               VALUES (%s, %s, %s, %s, %s) RETURNING id''',
            (act['name'], act.get('description'), act.get('next_workflow_step_name'),
             act.get('action_type'), workflow['name'])
        )
        action_id_map[act['client_id']] = str(rows[0]['id'])

    # 5. Create new option-to-action links
    for link in body.get('new_action_links', []):
        opt_id = link.get('option_id') or option_id_map.get(link.get('option_client_id'))
        act_id = link.get('action_id') or action_id_map.get(link.get('action_client_id'))
        if opt_id and act_id:
            execute(
                'INSERT INTO workflow_option_to_action (workflow_option_id, workflow_action_id) VALUES (%s, %s)',
                (opt_id, act_id)
            )

    return jsonify({'ok': True})


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
