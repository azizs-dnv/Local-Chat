"""Shared paths and local-network helpers for the admin GUI."""

import socket
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
SERVER_SCRIPT = PROJECT_DIR / "server.js"
UPLOADS_DIR = PROJECT_DIR / "uploads"


def get_local_ip():
    """Detect the local IP address on the active Wi-Fi/LAN network."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # No actual network request is made; this only detects the local route interface.
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
