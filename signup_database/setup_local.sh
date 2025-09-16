#!/bin/bash
set -euo pipefail

# This script will:
# 1) Start MongoDB locally and create users (via startup.sh)
# 2) Export env vars for the DB viewer
# 3) Run the schema initialization (init_mongo.js)
# 4) Optionally seed a demo user

cd "$(dirname "$0")"

echo "==> Starting local MongoDB and creating users (if needed)..."
bash startup.sh

echo "==> Loading environment variables..."
if [ -f "db_visualizer/mongodb.env" ]; then
  # shellcheck disable=SC1091
  source db_visualizer/mongodb.env
else
  echo "Error: db_visualizer/mongodb.env not found. Ensure startup.sh ran successfully or set MONGODB_URL and MONGODB_DB manually."
  exit 1
fi

echo "==> Initializing schema..."
mongosh "$MONGODB_URL/$MONGODB_DB" --file init_mongo.js

echo "==> (Optional) Seeding demo user..."
mongosh "$MONGODB_URL/$MONGODB_DB" --file seed_demo_user.js || true

echo "All done. Database is ready."
