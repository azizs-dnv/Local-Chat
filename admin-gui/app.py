"""Application window and server lifecycle for the LocalShare admin GUI."""

import os
import sys
import threading
import subprocess
import webbrowser
import time

import customtkinter as ctk
import qrcode

from config import PROJECT_DIR, SERVER_SCRIPT, UPLOADS_DIR, get_local_ip
from ui import AdminUIMixin

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")


class LocalShareApp(AdminUIMixin, ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("LocalShare — Server Admin")
        self.geometry("920x680")
        self.minsize(840, 620)

        # Server process state
        self.server_process = None
        self.server_thread = None
        self.is_running = False
        self.server_ip = get_local_ip()
        self.server_port = 3000
        self.server_url = f"http://{self.server_ip}:{self.server_port}"
        self.start_time = None

        self.setup_ui()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        # Background uptime timer
        self.after(1000, self.update_uptime_loop)

    def log(self, text):
        """Append a log line to the GUI in a thread-safe manner."""
        def append():
            self.log_textbox.configure(state="normal")
            self.log_textbox.insert("end", text + "\n")
            self.log_textbox.see("end")
            self.log_textbox.configure(state="disabled")
        self.after(0, append)

    def generate_qr_image(self, url):
        """Generate a high-quality QR code image with high-contrast colors."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        pil_img = img.convert("RGB")
        return ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(240, 240))

    def toggle_server(self):
        if not self.is_running:
            self.start_server()
        else:
            self.stop_server()

    def start_server(self):
        """Start the Node.js server process."""
        try:
            ip = self.entry_ip.get().strip() or get_local_ip()
            port = int(self.entry_port.get().strip() or "3000")
        except ValueError:
            self.log("[Error] Port must be a number between 1 and 65535")
            return

        self.server_ip = ip
        self.server_port = port
        self.server_url = f"http://{ip}:{port}"

        if not SERVER_SCRIPT.exists():
            self.log(f"[Error] Server file not found: {SERVER_SCRIPT}")
            return

        self.log(f"[Starting] Launching server at {self.server_url} ...")

        # Pass the port through the environment
        env = os.environ.copy()
        env["PORT"] = str(port)

        try:
            self.server_process = subprocess.Popen(
                ["node", str(SERVER_SCRIPT)],
                cwd=str(PROJECT_DIR),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
        except Exception as e:
            self.log(f"[Error] Could not start Node.js: {e}")
            return

        self.is_running = True
        self.start_time = time.time()

        # Update the UI
        self.lbl_status.configure(text="Server is active on the network", text_color="#10b981")
        self.status_dot.configure(text="●", text_color="#10b981")
        self.btn_toggle_server.configure(
            text="STOP SERVER",
            fg_color="#ef4444",
            hover_color="#dc2626"
        )
        self.entry_ip.configure(state="disabled")
        self.entry_port.configure(state="disabled")
        self.lbl_server_url.configure(text=self.server_url)
        self.btn_open_browser.configure(state="normal")
        self.btn_copy_url.configure(state="normal")

        # Display the QR code
        try:
            ctk_img = self.generate_qr_image(self.server_url)
            self.lbl_qr_image.configure(image=ctk_img, text="")
            self.lbl_qr_feedback.configure(text=f"Address: {self.server_url}")
        except Exception as e:
            self.log(f"[QR code error] {e}")

        # Log-reading thread
        self.server_thread = threading.Thread(target=self.stream_server_logs, daemon=True)
        self.server_thread.start()

    def stream_server_logs(self):
        """Read the server's stdout in the background."""
        if not self.server_process:
            return
        for line in iter(self.server_process.stdout.readline, ""):
            if line:
                self.log(line.rstrip())
        self.server_process.stdout.close()
        self.server_process.wait()

        # Handle an unexpected server exit
        if self.is_running:
            self.after(0, self.server_stopped_unexpectedly)

    def server_stopped_unexpectedly(self):
        self.log("[Info] The server process has exited.")
        self.reset_server_ui()

    def stop_server(self):
        """Stop the Node.js server process."""
        if self.server_process:
            self.log("[Stopping] Stopping the server...")
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=2)
            except Exception:
                try:
                    self.server_process.kill()
                except Exception:
                    pass
            self.server_process = None

        self.reset_server_ui()
        self.log("[Status] Server stopped.")

    def reset_server_ui(self):
        self.is_running = False
        self.start_time = None
        self.lbl_status.configure(text="Server stopped", text_color="#d1d5db")
        self.status_dot.configure(text="●", text_color="#ef4444")
        self.btn_toggle_server.configure(
            text="CREATE AND START SERVER",
            fg_color="#10b981",
            hover_color="#059669"
        )
        self.entry_ip.configure(state="normal")
        self.entry_port.configure(state="normal")
        self.lbl_server_url.configure(text="Server is not running")
        self.btn_open_browser.configure(state="disabled")
        self.btn_copy_url.configure(state="disabled")
        self.lbl_qr_image.configure(
            image=None,
            text="Click\n\"Create and Start Server\"\nto generate a QR code"
        )
        self.lbl_qr_feedback.configure(text="")
        self.lbl_uptime.configure(text="Uptime: 00:00:00")

    def update_uptime_loop(self):
        """Update the uptime counter."""
        if self.is_running and self.start_time:
            delta = int(time.time() - self.start_time)
            hrs = delta // 3600
            mins = (delta % 3600) // 60
            secs = delta % 60
            self.lbl_uptime.configure(text=f"Uptime: {hrs:02}:{mins:02}:{secs:02}")
        self.after(1000, self.update_uptime_loop)

    def open_browser(self):
        if self.server_url:
            webbrowser.open(self.server_url)

    def copy_url(self):
        if self.server_url:
            self.clipboard_clear()
            self.clipboard_append(self.server_url)
            self.update()
            self.lbl_qr_feedback.configure(text="Link copied to clipboard!")
            self.after(2500, lambda: self.lbl_qr_feedback.configure(text=f"Address: {self.server_url}"))

    def open_uploads_folder(self):
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        folder = str(UPLOADS_DIR)
        try:
            if sys.platform == "win32":
                os.startfile(folder)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
        except Exception as e:
            self.log(f"[Could not open folder] {e}")

    def on_close(self):
        """Shut down cleanly when the window is closed."""
        if self.server_process:
            try:
                self.server_process.terminate()
            except Exception:
                pass
        self.destroy()
