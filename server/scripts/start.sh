#!/bin/sh

echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Database migrations completed"

node index.js
