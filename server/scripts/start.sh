#!/bin/sh

echo "=== STARTUP SCRIPT EXECUTING ==="
echo "Current directory: $(pwd)"
echo "Files in current directory: $(ls -la)"
echo "DATABASE_URL exists: $([ -n "$DATABASE_URL" ] && echo "YES" || echo "NO")"

echo "=== RUNNING DATABASE MIGRATIONS ==="
if npx prisma migrate deploy --schema=./prisma/schema.prisma; then
    echo "=== MIGRATIONS COMPLETED SUCCESSFULLY ==="
else
    echo "=== MIGRATION FAILED, BUT CONTINUING ==="
fi

echo "=== STARTING NODE.JS SERVER ==="
exec node index.js
