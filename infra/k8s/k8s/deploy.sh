#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-default}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${DOCKER_REGISTRY:-your-registry}"
IMAGE_NAME="${IMAGE_NAME:-webclient-document-upload}"

echo -e "${GREEN}=== Webclient Document Upload Deployment Script ===${NC}"
echo ""

# Function to print section headers
print_header() {
    echo -e "${YELLOW}>>> $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_header "Checking prerequisites..."
if ! command_exists kubectl; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}All prerequisites met${NC}"
echo ""

# Build Docker image
print_header "Building Docker image..."
docker build -t ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} .
echo -e "${GREEN}Image built successfully${NC}"
echo ""

# Push Docker image
print_header "Pushing Docker image to registry..."
read -p "Push image to registry? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    echo -e "${GREEN}Image pushed successfully${NC}"
else
    echo -e "${YELLOW}Skipping image push${NC}"
fi
echo ""

# Update deployment image
print_header "Updating deployment image reference..."
sed -i.bak "s|image:.*|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|g" k8s/deployment.yaml
echo -e "${GREEN}Deployment updated${NC}"
echo ""

# Apply Kubernetes resources
print_header "Deploying to Kubernetes (namespace: ${NAMESPACE})..."
echo ""

# Create namespace if it doesn't exist
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply resources in order
echo "Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml -n ${NAMESPACE}

echo "Applying Secret..."
kubectl apply -f k8s/secret.yaml -n ${NAMESPACE}

echo "Applying PVC (optional)..."
read -p "Deploy with persistent storage? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f k8s/pvc.yaml -n ${NAMESPACE}
    # Update deployment to use PVC
    echo "Note: Make sure deployment.yaml is configured to use PVC"
fi

echo "Applying Deployment..."
kubectl apply -f k8s/deployment.yaml -n ${NAMESPACE}

echo "Applying Service..."
kubectl apply -f k8s/service.yaml -n ${NAMESPACE}

echo ""
read -p "Deploy Ingress? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f k8s/ingress.yaml -n ${NAMESPACE}
    echo -e "${GREEN}Ingress deployed${NC}"
else
    echo -e "${YELLOW}Skipping Ingress deployment${NC}"
fi

echo ""
print_header "Deployment completed!"
echo ""

# Wait for rollout
print_header "Waiting for deployment to be ready..."
kubectl rollout status deployment/webclient-document-upload -n ${NAMESPACE}
echo ""

# Show deployment status
print_header "Deployment Status:"
kubectl get pods -l app=webclient-document-upload -n ${NAMESPACE}
echo ""

print_header "Service Status:"
kubectl get svc webclient-document-upload -n ${NAMESPACE}
echo ""

# Restore backup
mv k8s/deployment.yaml.bak k8s/deployment.yaml 2>/dev/null || true

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "To view logs:"
echo "  kubectl logs -f deployment/webclient-document-upload -n ${NAMESPACE}"
echo ""
echo "To port-forward:"
echo "  kubectl port-forward svc/webclient-document-upload 8080:80 -n ${NAMESPACE}"
echo ""
