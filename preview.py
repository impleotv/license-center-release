"""Serve the site with correct JavaScript MIME types, including on Windows."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial

SimpleHTTPRequestHandler.extensions_map = {
    **SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.css': 'text/css',
}
handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent))
print('Preview: http://127.0.0.1:8769', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8769), handler).serve_forever()
