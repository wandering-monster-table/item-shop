#!/usr/bin/env python3

"""
Local development server for D&D Equipment Shop.

Run from the project root:

    python server.py

Then open:

    http://localhost:8000/

This file is only required for local development/hosting.
The application itself remains a static HTML/CSS/JavaScript application.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "127.0.0.1"
PORT = 8000

PROJECT_ROOT = Path(__file__).resolve().parent


class StaticHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(
            *args,
            directory=PROJECT_ROOT,
            **kwargs
        )


def main():

    server = ThreadingHTTPServer(
        (HOST, PORT),
        StaticHandler
    )

    print(f"Serving: {PROJECT_ROOT}")
    print(f"Open:    http://{HOST}:{PORT}/")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nStopping server...")

    finally:
        server.server_close()


if __name__ == "__main__":
    main()