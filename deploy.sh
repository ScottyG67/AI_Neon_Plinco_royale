#!/bin/bash

# Deployment script for Google Cloud Run
# Configuration is loaded from .env.deploy file
# Service name, region, and other settings are defined there

set -e  # Exit on error

# Load environment variables from .env.deploy file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"

if [ ! -f "${ENV_FILE}" ]; then
    echo "❌ Error: .env.deploy file not found!"
    echo "Please create .env.deploy based on .env.deploy.example"
    exit 1
fi

# Source the environment file
set -a  # Automatically export all variables
source "${ENV_FILE}"
set +a  # Stop automatically exporting

# Validate required variables
if [ -z "${PROJECT_ID}" ] || [ -z "${SERVICE_NAME}" ] || [ -z "${REGION}" ] || [ -z "${REPOSITORY_NAME}" ]; then
    echo "❌ Error: Missing required environment variables in .env.deploy"
    echo "Required: PROJECT_ID, SERVICE_NAME, REGION, REPOSITORY_NAME"
    exit 1
fi

# Use Artifact Registry format
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY_NAME}/${SERVICE_NAME}:latest"
# Use build timestamp in env var to force new revision
BUILD_TIMESTAMP=$(date +%s)

echo "🚀 Starting deployment to Google Cloud Run..."
echo "Project: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "⚠️  Not authenticated with gcloud. Running gcloud auth login..."
    gcloud auth login
fi

# Set the project
echo "📋 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Check if Artifact Registry repository exists in the specified region
echo "📦 Checking Artifact Registry repository in ${REGION}..."
if ! gcloud artifacts repositories list --location=${REGION} --project=${PROJECT_ID} --format="value(name)" 2>/dev/null | grep -q "^${REPOSITORY_NAME}$"; then
    echo "📦 Creating Artifact Registry repository: ${REPOSITORY_NAME} in ${REGION}..."
    gcloud artifacts repositories create ${REPOSITORY_NAME} \
        --repository-format=docker \
        --location=${REGION} \
        --project=${PROJECT_ID}
else
    echo "✅ Repository ${REPOSITORY_NAME} already exists in ${REGION}"
fi

# Build and push the Docker image
echo "🐳 Building Docker image..."
echo "   Image will be: ${IMAGE_NAME}"
gcloud builds submit --tag ${IMAGE_NAME} --project=${PROJECT_ID}

# Deploy to Cloud Run
# Using BUILD_TIMESTAMP in env vars forces a new revision even if image tag is same
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=1 \
    --timeout=300 \
    --set-env-vars=NODE_ENV=qa,BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    --project=${PROJECT_ID}

# Get the service URL and latest revision
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
LATEST_REVISION=$(gcloud run revisions list --service ${SERVICE_NAME} --region ${REGION} --limit 1 --format 'value(name)')

echo ""
echo "✅ Deployment complete!"
echo "📦 Image: ${IMAGE_NAME}"
echo "🕐 Build Timestamp: ${BUILD_TIMESTAMP}"
echo "🔄 Latest Revision: ${LATEST_REVISION}"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "💡 Tip: If you don't see updates, try:"
echo "   1. Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)"
echo "   2. Clear browser cache"
echo "   3. Check the revision in Cloud Console to verify it's using the new image"
echo ""
echo "You can view the service at:"
echo "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}?project=${PROJECT_ID}"
