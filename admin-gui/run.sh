#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Create the virtual environment if it does not already exist.
if [ ! -d ".venv" ]; then
    echo "Setting up the Python environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r requirements.txt
fi

echo "Starting the LocalShare admin GUI..."
exec .venv/bin/python main.py "$@"
