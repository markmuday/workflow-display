from flask import Blueprint, jsonify, Flask
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_http_middleware import MiddlewareManager, BaseHTTPMiddleware

from db.database import transactional
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
