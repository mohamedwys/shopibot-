#!/bin/bash

# Deployment script with retry logic for advisory lock timeouts
# This script will retry migrations if they fail due to lock timeouts

MAX_RETRIES=3
RETRY_DELAY=15

echo "🚀 Starting deployment with retry logic..."

# Function to run migrations with retry
run_migrations() {
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "📦 Attempt $attempt/$MAX_RETRIES: Running Prisma migrations..."

    if npx prisma migrate deploy; then
      echo "✅ Migrations completed successfully!"
      return 0
    else
      exit_code=$?

      if [ $attempt -lt $MAX_RETRIES ]; then
        echo "⚠️  Migration failed with exit code $exit_code. Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
        attempt=$((attempt + 1))
      else
        echo "❌ Migration failed after $MAX_RETRIES attempts"
        return $exit_code
      fi
    fi
  done
}

# Run migrations with retry
if ! run_migrations; then
  echo "❌ Deployment failed: Could not complete migrations"
  exit 1
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
if ! npx prisma generate --no-engine; then
  echo "❌ Failed to generate Prisma Client"
  exit 1
fi

# Build the app
echo "🏗️  Building application..."
if ! npm run build; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Deployment completed successfully!"
