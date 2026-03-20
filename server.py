import re
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

class Router:
    """Simple regex-based route handler"""
    def __init__(self):
        self.routes = {
            'GET': [],
            'POST': [],
            'PUT': [],
            'DELETE': [],
            'PATCH': [],
        }

    def register(self, method, pattern, handler):
        """Register a route with regex pattern"""
        regex = re.compile('^' + pattern + '$')
        self.routes[method].append((regex, handler))

    def match(self, method, path):
        """Match path against registered routes"""
        for regex, handler in self.routes.get(method, []):
            match = regex.match(path)
            if match:
                return handler, match.groupdict()
        return None, None

    def get(self, pattern, handler):
        self.register('GET', pattern, handler)

    def post(self, pattern, handler):
        self.register('POST', pattern, handler)

    def put(self, pattern, handler):
        self.register('PUT', pattern, handler)

    def delete(self, pattern, handler):
        self.register('DELETE', pattern, handler)

    def patch(self, pattern, handler):
        self.register('PATCH', pattern, handler)


class ATSRequestHandler(BaseHTTPRequestHandler):
    """Custom HTTP request handler"""
    router = None
    static_dir = None

    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

    def do_GET(self):
        self.handle_request('GET')

    def do_POST(self):
        self.handle_request('POST')

    def do_PUT(self):
        self.handle_request('PUT')

    def do_DELETE(self):
        self.handle_request('DELETE')

    def do_PATCH(self):
        self.handle_request('PATCH')

    def handle_request(self, method):
        """Handle incoming request"""
        path = urlparse(self.path).path
        query_string = urlparse(self.path).query
        params = parse_qs(query_string) if query_string else {}

        # Try to match route
        handler, route_params = self.router.match(method, path)

        if handler:
            try:
                # Parse request body if present
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else b''

                # Create request context
                request = {
                    'method': method,
                    'path': path,
                    'params': params,
                    'route_params': route_params or {},
                    'body': body,
                    'headers': dict(self.headers),
                }

                # Call handler
                response = handler(request)

                # Send response
                self.send_json_response(response.get('status', 200), response.get('data', {}))
            except Exception as e:
                print(f"Error handling {method} {path}: {e}")
                self.send_json_response(500, {'error': 'Internal server error'})
        else:
            # Try to serve static file
            if not self.serve_static(path):
                self.send_json_response(404, {'error': 'Not found'})

    def serve_static(self, path):
        """Serve static files"""
        if not self.static_dir:
            return False

        # Prevent directory traversal
        if '..' in path:
            return False

        file_path = Path(self.static_dir) / path.lstrip('/')

        # Serve index.html for root path
        if path == '/' or path == '':
            file_path = Path(self.static_dir) / 'index.html'

        if file_path.exists() and file_path.is_file():
            try:
                mime_type, _ = mimetypes.guess_type(str(file_path))
                mime_type = mime_type or 'application/octet-stream'

                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()

                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())

                return True
            except Exception:
                return False

        return False

    def send_json_response(self, status_code, data):
        """Send JSON response with CORS headers"""
        response_body = json.dumps(data).encode('utf-8')

        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(response_body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(response_body)

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()


def parse_json_body(body):
    """Parse JSON from request body"""
    if not body:
        return {}
    try:
        return json.loads(body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def to_camel_case(snake_str):
    """Convert snake_case string to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


def convert_keys_to_camel(obj):
    """Recursively convert dictionary keys from snake_case to camelCase"""
    if isinstance(obj, list):
        return [convert_keys_to_camel(item) for item in obj]
    elif isinstance(obj, dict):
        return {to_camel_case(k): convert_keys_to_camel(v) for k, v in obj.items()}
    return obj


def get_pagination_params(params):
    """Extract pagination parameters from query string"""
    page = int(params.get('page', ['1'])[0])
    per_page = int(params.get('per_page', ['20'])[0])
    return max(1, page), min(100, per_page)


def create_app(router, static_dir=None):
    """Create HTTP server"""
    ATSRequestHandler.router = router
    ATSRequestHandler.static_dir = static_dir

    return HTTPServer(('localhost', 8080), ATSRequestHandler)
