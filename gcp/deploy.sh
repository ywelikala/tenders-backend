#!/bin/bash

# Google Cloud Platform deployment script for tenders-backend
# This script sets up and deploys the application to Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="tenders-backend"
MONGODB_URI=""
JWT_SECRET=""
SYSTEM_USER_PASSWORD=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud SDK is not installed. Please install it from https://cloud.google.com/sdk"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to get user input
get_user_input() {
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    fi
    
    if [ -z "$MONGODB_URI" ]; then
        read -p "Enter your MongoDB Atlas URI: " MONGODB_URI
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        read -p "Enter your JWT Secret: " JWT_SECRET
    fi
    
    if [ -z "$SYSTEM_USER_PASSWORD" ]; then
        read -p "Enter System User Password: " SYSTEM_USER_PASSWORD
    fi
}

# Function to set up GCP project
setup_gcp_project() {
    print_status "Setting up Google Cloud Project: $PROJECT_ID"
    
    # Set the project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    print_status "Enabling required Google Cloud APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    gcloud services enable secretmanager.googleapis.com
    
    print_success "Google Cloud APIs enabled"
}

# Function to create secrets
create_secrets() {
    print_status "Creating secrets in Secret Manager..."
    
    # Create MongoDB URI secret
    echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=- || \
    echo -n "$MONGODB_URI" | gcloud secrets versions add mongodb-uri --data-file=-
    
    # Create JWT Secret
    echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- || \
    echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
    
    # Create System User Password
    echo -n "$SYSTEM_USER_PASSWORD" | gcloud secrets create system-user-password --data-file=- || \
    echo -n "$SYSTEM_USER_PASSWORD" | gcloud secrets versions add system-user-password --data-file=-
    
    print_success "Secrets created in Secret Manager"
}

# Function to build and deploy
build_and_deploy() {
    print_status "Building and deploying application..."
    
    # Build the image using Cloud Build
    print_status "Building Docker image with Cloud Build..."
    gcloud builds submit --config=gcp/cloudbuild.yaml --substitutions=_PROJECT_ID=$PROJECT_ID
    
    # Deploy to Cloud Run
    print_status "Deploying to Cloud Run..."
    gcloud run deploy $SERVICE_NAME \
        --image gcr.io/$PROJECT_ID/tenders-backend:latest \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --port 3000 \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --set-env-vars NODE_ENV=production,PORT=3000,JWT_EXPIRES_IN=7d,SYSTEM_USER_EMAIL=system@tenders.lk \
        --set-secrets MONGODB_URI=mongodb-uri:latest,JWT_SECRET=jwt-secret:latest,SYSTEM_USER_PASSWORD=system-user-password:latest
    
    print_success "Application deployed successfully!"
}

# Function to get service URL
get_service_url() {
    print_status "Getting service URL..."
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
    print_success "Service is available at: $SERVICE_URL"
    print_status "Health check: $SERVICE_URL/api/health"
}

# Function to test deployment
test_deployment() {
    print_status "Testing deployment..."
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
    
    if curl -f "$SERVICE_URL/api/health" > /dev/null 2>&1; then
        print_success "Deployment test passed! Service is healthy"
    else
        print_warning "Deployment test failed. Please check the logs:"
        print_status "gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
    fi
}

# Main execution
main() {
    echo "🚀 Google Cloud Platform Deployment Script"
    echo "=========================================="
    
    check_prerequisites
    get_user_input
    setup_gcp_project
    create_secrets
    build_and_deploy
    get_service_url
    test_deployment
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "========================"
    echo "Service Name: $SERVICE_NAME"
    echo "Region: $REGION"
    echo "Project: $PROJECT_ID"
    echo "URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"
    echo ""
    echo "Useful commands:"
    echo "  View logs: gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
    echo "  Update service: gcloud run deploy $SERVICE_NAME --region=$REGION"
    echo "  Delete service: gcloud run services delete $SERVICE_NAME --region=$REGION"
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi