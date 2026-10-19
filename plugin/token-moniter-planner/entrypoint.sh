#!/bin/sh
set -e

echo "===================================================="
echo "⚠️ DOCKER ALERT: Running Token Monitor & Planner Viewer"
echo "Ensure port 3001 is mapped: docker run -p 3001:3001 ..."
echo "Access the viewer at: http://localhost:3001"
echo "===================================================="

exec node /app/commands/planning.js
