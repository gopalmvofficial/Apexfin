import sys
import os
import uvicorn

root_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(root_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.app.main import app

def find_available_port(preferred: int) -> int:
    import socket
    for p in range(preferred, preferred + 20):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", p))
                return p
        except OSError:
            continue
    return preferred

if __name__ == "__main__":
    requested_port = int(os.environ.get("PORT", "8000"))
    port = find_available_port(requested_port)
    print(f"==> Starting ApexFin Enterprise FastAPI on http://127.0.0.1:{port} (Swagger docs at /docs)")
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
