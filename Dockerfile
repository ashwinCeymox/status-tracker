FROM node:18-alpine

WORKDIR /app

# Copy plugin files
COPY plugin/token-moniter-planner /app/plugin/token-moniter-planner

# Create a small entrypoint script for the alert
RUN echo '#!/bin/sh' > /app/entrypoint.sh &&     echo 'echo "===================================================="' >> /app/entrypoint.sh &&     echo 'echo "⚠️ DOCKER ALERT: Token Monitor & Planner running"' >> /app/entrypoint.sh &&     echo 'echo "Access viewer at: http://localhost:3001"' >> /app/entrypoint.sh &&     echo 'echo "===================================================="' >> /app/entrypoint.sh &&     echo 'exec node /app/plugin/token-moniter-planner/commands/planning.js' >> /app/entrypoint.sh &&     chmod +x /app/entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
