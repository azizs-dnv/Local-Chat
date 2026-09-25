# LAN Chat

Local chat and file sharing between devices on the same Wi-Fi/LAN network. The server does not require an internet connection.

## Features

- Real-time messaging over WebSocket.
- Upload and download files up to 100 GB.
- Participant list and a QR code for quick connection.
- Web interface for phones and computers.
- Optional desktop GUI for starting the server and configuring its address and port.

## Requirements

- Node.js 18 or newer.
- Python 3 and Tkinter for the optional GUI.

## Run the web app

From the project root, install the dependencies and start the server:

```bash
npm install
npm start
```

Open `http://localhost:3000` on the host computer. The terminal prints addresses that other devices on the same local network can use. Make sure the firewall allows incoming connections on the selected port.

To use a different port:

```bash
PORT=4000 npm start
```

In Windows PowerShell:

```powershell
$env:PORT = 4000
npm start
```

## Optional admin GUI

The launcher creates a Python virtual environment and installs the GUI dependencies on first run.

- Linux: `./start-gui.sh`
- Windows: run `admin-gui\run.bat`.

On Linux, if Tkinter is missing, install the Tkinter package for your Python version from your distribution's package repository.

## Data and security

This app is intended for use on a trusted local network. It has no authentication or encryption: anyone who connects to the server can send messages, upload files, and delete shared files. Do not expose the server port to the internet or use the app on an untrusted network.

Uploaded files are stored in `uploads/`. The file list and chat messages are kept in memory and reset when the server restarts. Files left on disk are not automatically restored to the shared list. The `uploads/` directory is excluded from Git to avoid publishing user files.

## License

This project is licensed under Apache-2.0. See [LICENSE](LICENSE).
