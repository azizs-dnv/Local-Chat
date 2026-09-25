#!/usr/bin/env python3
"""Launch the LocalShare admin GUI."""

from app import LocalShareApp


def main():
    application = LocalShareApp()
    application.mainloop()


if __name__ == "__main__":
    main()
