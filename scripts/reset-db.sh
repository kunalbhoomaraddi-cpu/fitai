#!/usr/bin/env bash
# Deletes the local SQLite database (all local accounts and data). Recreated on next start.
set -e
DB="$(cd "$(dirname "$0")/../backend" && pwd)/fitai.db"
read -r -p "Delete $DB? [y/N] " a; [[ "$a" == "y" ]] && rm -f "$DB" && echo "Database removed."
