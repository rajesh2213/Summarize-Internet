#!/bin/sh

echo "=== STARTUP SCRIPT EXECUTING ==="
echo "Current directory: $(pwd)"
echo "Files in current directory: $(ls -la)"
echo "DATABASE_URL exists: $([ -n "$DATABASE_URL" ] && echo "YES" || echo "NO")"

echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Database migrations completed"
echo "Starting Node.js server..."

node index.js
