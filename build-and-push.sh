#!/bin/bash
# Local Docker Build and Push Script
# Usage: ./build-and-push.sh [tag]

set -e

# Configuration
DOCKER_REGISTRY="registry.sycapt.com:32547"
IMAGE_NAME="webclient-document-uploader"
DOCKER_IMAGE="${DOCKER_REGISTRY}/${IMAGE_NAME}"

# Get tag from argument or use 'local' as default
TAG="${1:-local}"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "========================================="
echo "Building Docker Image"
echo "========================================="
echo "Registry: ${DOCKER_REGISTRY}"
echo "Image: ${IMAGE_NAME}"
echo "Tag: ${TAG}"
echo "Git Commit: ${GIT_COMMIT}"
echo "Build Date: ${BUILD_DATE}"
echo "========================================="

# Build the Docker image
echo ""
echo "Step 1: Building Docker image..."
docker build \
  --tag ${DOCKER_IMAGE}:${TAG} \
  --tag ${DOCKER_IMAGE}:${GIT_COMMIT} \
  --build-arg BUILD_DATE=${BUILD_DATE} \
  --build-arg VCS_REF=${GIT_COMMIT} \
  --build-arg VERSION=${TAG} \
  --progress=plain \
  .

echo ""
echo "✓ Build completed successfully!"

# Ask for confirmation before pushing
echo ""
read -p "Do you want to push to registry? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "Step 2: Logging in to Docker registry..."
    docker login ${DOCKER_REGISTRY}

    echo ""
    echo "Step 3: Pushing Docker image..."
    docker push ${DOCKER_IMAGE}:${TAG}
    docker push ${DOCKER_IMAGE}:${GIT_COMMIT}

    echo ""
    echo "✓ Push completed successfully!"
    echo ""
    echo "Image pushed to:"
    echo "  - ${DOCKER_IMAGE}:${TAG}"
    echo "  - ${DOCKER_IMAGE}:${GIT_COMMIT}"
else
    echo ""
    echo "Skipping push to registry."
    echo ""
    echo "Local image available as:"
    echo "  - ${DOCKER_IMAGE}:${TAG}"
    echo "  - ${DOCKER_IMAGE}:${GIT_COMMIT}"
fi

echo ""
echo "========================================="
echo "Build Summary"
echo "========================================="
docker images ${DOCKER_IMAGE} | head -n 5

echo ""
echo "To deploy to Kubernetes, run:"
echo "  kubectl set image deployment/webclient-chat webclient-chat=${DOCKER_IMAGE}:${TAG} -n default"
echo "  kubectl rollout status deployment/webclient-chat -n default"
echo ""
