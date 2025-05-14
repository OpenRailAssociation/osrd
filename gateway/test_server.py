import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

if len(sys.argv) != 3:
    print("Usage: python3 simple_http_server.py <port> <response_text>")
    sys.exit(1)

PORT = int(sys.argv[1])
RESPONSE_BASE = sys.argv[2]

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(f"{RESPONSE_BASE}: {self.path}".encode())

httpd = HTTPServer(("localhost", PORT), SimpleHandler)
print(f"Serving '{RESPONSE_BASE}' on http://localhost:{PORT}")
httpd.serve_forever()
