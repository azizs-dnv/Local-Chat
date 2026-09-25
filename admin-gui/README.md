# LocalShare Admin GUI

Desktop admin panel for managing the **LocalShare** server (local chat and file sharing up to 100 GB).

Built with **CustomTkinter**, featuring a modern dark theme, vector icons, and automatic QR code generation.

---

## Features

- **One-click server startup**: detects your Wi-Fi IP address and starts the Node.js server.
- **On-screen QR code**: users can scan it with a phone camera to open the chat.
- **Quick browser access**: copy the server URL or open it directly.
- **Quick access to files**: open the `uploads/` directory.
- **Live server log**: view server output in real time.
- **Offline use**: after setup, the app works on an isolated Wi-Fi network without internet access.

---

## Run

### Linux / macOS
```bash
./run.sh
```
Or, from the project root:
```bash
./start-gui.sh
```

### Windows
Double-click `run.bat`.

---

## Run manually with Python

```bash
# 1. Create a virtual environment and install dependencies:
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Start the GUI:
.venv/bin/python main.py
```

## Code layout

- `main.py` is the launcher used by the shell scripts and PyInstaller.
- `app.py` contains the application window and server lifecycle.
- `ui.py` builds the admin window's widgets.
- `config.py` contains project paths and local-network helpers.
