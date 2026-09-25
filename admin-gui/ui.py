"""Tkinter widget construction for the LocalShare admin window."""

import customtkinter as ctk


class AdminUIMixin:
    def setup_ui(self):
        # Main grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # ── 1. HEADER ─────────────────────────────────────────────────
        header_frame = ctk.CTkFrame(self, fg_color="#181a24", corner_radius=0, height=70)
        header_frame.grid(row=0, column=0, sticky="ew")
        header_frame.grid_columnconfigure(1, weight=1)

        # Title and subtitle
        title_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_box.grid(row=0, column=0, padx=24, pady=14, sticky="w")

        lbl_app_name = ctk.CTkLabel(
            title_box,
            text="LocalShare Admin",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#ffffff"
        )
        lbl_app_name.pack(anchor="w")

        lbl_app_sub = ctk.CTkLabel(
            title_box,
            text="Local file-sharing (up to 100 GB) and chat server over Wi-Fi",
            font=ctk.CTkFont(size=12),
            text_color="#9ca3af"
        )
        lbl_app_sub.pack(anchor="w")

        # Status indicator
        status_box = ctk.CTkFrame(header_frame, fg_color="#232736", corner_radius=20)
        status_box.grid(row=0, column=2, padx=24, pady=16, sticky="e")

        self.status_dot = ctk.CTkLabel(
            status_box,
            text="●",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#ef4444"
        )
        self.status_dot.pack(side="left", padx=(12, 4), pady=4)

        self.lbl_status = ctk.CTkLabel(
            status_box,
            text="Server stopped",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#d1d5db"
        )
        self.lbl_status.pack(side="left", padx=(0, 14), pady=4)

        # ── 2. MAIN CONTENT (TWO COLUMNS) ─────────────────────────────
        content_frame = ctk.CTkFrame(self, fg_color="transparent")
        content_frame.grid(row=1, column=0, sticky="nsew", padx=20, pady=16)
        content_frame.grid_columnconfigure(0, weight=6)
        content_frame.grid_columnconfigure(1, weight=5)
        content_frame.grid_rowconfigure(0, weight=1)

        # ── Left column: controls and settings ────────────────────────
        left_card = ctk.CTkFrame(content_frame, fg_color="#1e212d", corner_radius=16)
        left_card.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        left_card.grid_columnconfigure(0, weight=1)

        lbl_cfg_title = ctk.CTkLabel(
            left_card,
            text="Server settings",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#f3f4f6"
        )
        lbl_cfg_title.pack(anchor="w", padx=20, pady=(20, 14))

        # IP address field
        ip_box = ctk.CTkFrame(left_card, fg_color="transparent")
        ip_box.pack(fill="x", padx=20, pady=6)

        ctk.CTkLabel(
            ip_box,
            text="Wi-Fi network IP address:",
            font=ctk.CTkFont(size=13),
            text_color="#9ca3af"
        ).pack(anchor="w", pady=(0, 4))

        self.entry_ip = ctk.CTkEntry(
            ip_box,
            height=38,
            font=ctk.CTkFont(family="Consolas", size=14),
            border_color="#2f3549"
        )
        self.entry_ip.insert(0, self.server_ip)
        self.entry_ip.pack(fill="x")

        # Port field
        port_box = ctk.CTkFrame(left_card, fg_color="transparent")
        port_box.pack(fill="x", padx=20, pady=6)

        ctk.CTkLabel(
            port_box,
            text="Network port:",
            font=ctk.CTkFont(size=13),
            text_color="#9ca3af"
        ).pack(anchor="w", pady=(0, 4))

        self.entry_port = ctk.CTkEntry(
            port_box,
            height=38,
            font=ctk.CTkFont(family="Consolas", size=14),
            border_color="#2f3549"
        )
        self.entry_port.insert(0, str(self.server_port))
        self.entry_port.pack(fill="x")

        # Main start/stop button
        self.btn_toggle_server = ctk.CTkButton(
            left_card,
            text="CREATE AND START SERVER",
            font=ctk.CTkFont(size=15, weight="bold"),
            height=48,
            corner_radius=12,
            fg_color="#10b981",
            hover_color="#059669",
            command=self.toggle_server
        )
        self.btn_toggle_server.pack(fill="x", padx=20, pady=(18, 12))

        # Connection URL and quick actions card
        self.actions_box = ctk.CTkFrame(left_card, fg_color="#161822", corner_radius=12)
        self.actions_box.pack(fill="x", padx=20, pady=8)

        lbl_act_title = ctk.CTkLabel(
            self.actions_box,
            text="Browser connection address:",
            font=ctk.CTkFont(size=12),
            text_color="#9ca3af"
        )
        lbl_act_title.pack(anchor="w", padx=16, pady=(12, 4))

        self.lbl_server_url = ctk.CTkLabel(
            self.actions_box,
            text="Server is not running",
            font=ctk.CTkFont(family="Consolas", size=14, weight="bold"),
            text_color="#818cf8"
        )
        self.lbl_server_url.pack(anchor="w", padx=16, pady=(0, 10))

        btn_row = ctk.CTkFrame(self.actions_box, fg_color="transparent")
        btn_row.pack(fill="x", padx=16, pady=(0, 12))
        btn_row.grid_columnconfigure((0, 1, 2), weight=1)

        self.btn_open_browser = ctk.CTkButton(
            btn_row,
            text="Open in browser",
            height=34,
            corner_radius=8,
            fg_color="#3b82f6",
            hover_color="#2563eb",
            state="disabled",
            command=self.open_browser
        )
        self.btn_open_browser.grid(row=0, column=0, padx=(0, 4), sticky="ew")

        self.btn_copy_url = ctk.CTkButton(
            btn_row,
            text="Copy link",
            height=34,
            corner_radius=8,
            fg_color="#374151",
            hover_color="#4b5563",
            state="disabled",
            command=self.copy_url
        )
        self.btn_copy_url.grid(row=0, column=1, padx=4, sticky="ew")

        self.btn_open_folder = ctk.CTkButton(
            btn_row,
            text="Uploads folder",
            height=34,
            corner_radius=8,
            fg_color="#374151",
            hover_color="#4b5563",
            command=self.open_uploads_folder
        )
        self.btn_open_folder.grid(row=0, column=2, padx=(4, 0), sticky="ew")

        # Information panel
        info_label = ctk.CTkLabel(
            left_card,
            text="Anyone on the network can open this address in a phone or laptop browser. No app installation is required.",
            font=ctk.CTkFont(size=12),
            text_color="#6b7280",
            wraplength=380,
            justify="left"
        )
        info_label.pack(anchor="w", padx=20, pady=(10, 16))

        # ── Right column: large QR code ───────────────────────────────
        right_card = ctk.CTkFrame(content_frame, fg_color="#1e212d", corner_radius=16)
        right_card.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        right_card.grid_columnconfigure(0, weight=1)

        lbl_qr_title = ctk.CTkLabel(
            right_card,
            text="Connection QR code",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#f3f4f6"
        )
        lbl_qr_title.pack(anchor="w", padx=20, pady=(20, 4))

        lbl_qr_sub = ctk.CTkLabel(
            right_card,
            text="Show this screen so participants can scan the code with a phone camera to join.",
            font=ctk.CTkFont(size=12),
            text_color="#9ca3af",
            wraplength=320,
            justify="left"
        )
        lbl_qr_sub.pack(anchor="w", padx=20, pady=(0, 16))

        # QR code container
        self.qr_container = ctk.CTkFrame(
            right_card,
            fg_color="#14161f",
            corner_radius=16,
            width=280,
            height=280
        )
        self.qr_container.pack(padx=20, pady=10, fill="none", expand=True)
        self.qr_container.pack_propagate(False)

        self.lbl_qr_image = ctk.CTkLabel(
            self.qr_container,
            text="Click\n\"Create and Start Server\"\nto generate a QR code",
            font=ctk.CTkFont(size=13),
            text_color="#6b7280"
        )
        self.lbl_qr_image.pack(expand=True)

        self.lbl_qr_feedback = ctk.CTkLabel(
            right_card,
            text="",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#10b981"
        )
        self.lbl_qr_feedback.pack(pady=(0, 16))

        # ── 3. FOOTER: SERVER LOG ─────────────────────────────────────
        bottom_frame = ctk.CTkFrame(self, fg_color="#161822", corner_radius=12)
        bottom_frame.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 16))
        bottom_frame.grid_columnconfigure(0, weight=1)

        bottom_header = ctk.CTkFrame(bottom_frame, fg_color="transparent")
        bottom_header.pack(fill="x", padx=16, pady=(10, 4))

        ctk.CTkLabel(
            bottom_header,
            text="Server log:",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#9ca3af"
        ).pack(side="left")

        self.lbl_uptime = ctk.CTkLabel(
            bottom_header,
            text="Uptime: 00:00:00",
            font=ctk.CTkFont(size=12),
            text_color="#6b7280"
        )
        self.lbl_uptime.pack(side="right")

        self.log_textbox = ctk.CTkTextbox(
            bottom_frame,
            height=100,
            font=ctk.CTkFont(family="Consolas", size=11),
            fg_color="#0f1117",
            border_color="#242838",
            border_width=1,
            corner_radius=8,
            text_color="#d1d5db"
        )
        self.log_textbox.pack(fill="x", padx=16, pady=(0, 12))
        self.log_textbox.configure(state="disabled")
