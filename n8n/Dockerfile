FROM n8nio/n8n:latest

# n8n stores workflows, credentials, and execution data here
ENV N8N_USER_FOLDER=/home/node/.n8n
ENV N8N_PORT=8080

# Use SQLite for persistence (stored on Fly volume)
ENV DB_TYPE=sqlite
ENV DB_SQLITE_DATABASE=/home/node/.n8n/database.sqlite

# Security: require login
ENV N8N_BASIC_AUTH_ACTIVE=true

# Webhook URL will be set via fly secrets
# ENV WEBHOOK_URL=https://n8n-resumetailor.fly.dev

EXPOSE 8080
