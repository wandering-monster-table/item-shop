from http.server import HTTPServer, SimpleHTTPRequestHandler

HOST = "localhost"
PORT = 8000

server = HTTPServer((HOST, PORT), SimpleHTTPRequestHandler)

print(f"Server running at http://{HOST}:{PORT}")
print("Press Ctrl+C to stop.")

server.serve_forever()