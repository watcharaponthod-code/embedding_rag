# Makefile for Kubernetes deployment operations

# Configuration
NAMESPACE ?= default
IMAGE_TAG ?= latest
REGISTRY ?= your-registry
IMAGE_NAME ?= webclient-document-upload
FULL_IMAGE = $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

.PHONY: help build push deploy delete logs status port-forward clean all

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

build: ## Build Docker image
	@echo "Building Docker image: $(FULL_IMAGE)"
	docker build -t $(FULL_IMAGE) ..

push: build ## Build and push Docker image
	@echo "Pushing Docker image: $(FULL_IMAGE)"
	docker push $(FULL_IMAGE)

deploy-config: ## Deploy ConfigMap and Secret
	@echo "Deploying ConfigMap and Secret to namespace: $(NAMESPACE)"
	kubectl apply -f configmap.yaml -n $(NAMESPACE)
	kubectl apply -f secret.yaml -n $(NAMESPACE)

deploy-app: ## Deploy application (Deployment + Service)
	@echo "Deploying application to namespace: $(NAMESPACE)"
	kubectl apply -f deployment.yaml -n $(NAMESPACE)
	kubectl apply -f service.yaml -n $(NAMESPACE)

deploy-pvc: ## Deploy PersistentVolumeClaim
	@echo "Deploying PVC to namespace: $(NAMESPACE)"
	kubectl apply -f pvc.yaml -n $(NAMESPACE)

deploy-ingress: ## Deploy Ingress
	@echo "Deploying Ingress to namespace: $(NAMESPACE)"
	kubectl apply -f ingress.yaml -n $(NAMESPACE)

deploy: deploy-config deploy-app ## Deploy all resources (config + app)
	@echo "Deployment complete!"

deploy-all: deploy-config deploy-pvc deploy-app deploy-ingress ## Deploy all resources including PVC and Ingress
	@echo "Full deployment complete!"

delete: ## Delete all resources
	@echo "Deleting all resources from namespace: $(NAMESPACE)"
	kubectl delete -f . -n $(NAMESPACE) --ignore-not-found=true

rollout-restart: ## Restart the deployment
	kubectl rollout restart deployment/webclient-document-upload -n $(NAMESPACE)

rollout-status: ## Check rollout status
	kubectl rollout status deployment/webclient-document-upload -n $(NAMESPACE)

logs: ## Show application logs
	kubectl logs -f deployment/webclient-document-upload -n $(NAMESPACE)

logs-tail: ## Show last 100 lines of logs
	kubectl logs --tail=100 deployment/webclient-document-upload -n $(NAMESPACE)

status: ## Show deployment status
	@echo "=== Pods ==="
	kubectl get pods -l app=webclient-document-upload -n $(NAMESPACE)
	@echo ""
	@echo "=== Services ==="
	kubectl get svc webclient-document-upload -n $(NAMESPACE)
	@echo ""
	@echo "=== Ingress ==="
	kubectl get ingress -l app=webclient-document-upload -n $(NAMESPACE) 2>/dev/null || echo "No Ingress found"

describe: ## Describe deployment
	kubectl describe deployment webclient-document-upload -n $(NAMESPACE)

describe-pod: ## Describe pods
	kubectl describe pods -l app=webclient-document-upload -n $(NAMESPACE)

events: ## Show recent events
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp' | grep webclient

port-forward: ## Port forward service to localhost:8080
	@echo "Forwarding service to http://localhost:8080"
	kubectl port-forward svc/webclient-document-upload 8080:80 -n $(NAMESPACE)

exec: ## Execute shell in pod
	kubectl exec -it deployment/webclient-document-upload -n $(NAMESPACE) -- /bin/sh

scale: ## Scale deployment (usage: make scale REPLICAS=3)
	kubectl scale deployment/webclient-document-upload --replicas=$(REPLICAS) -n $(NAMESPACE)

kustomize-build: ## Build resources using kustomize
	kubectl kustomize .

kustomize-deploy: ## Deploy using kustomize
	kubectl apply -k .

kustomize-delete: ## Delete using kustomize
	kubectl delete -k .

clean: ## Clean local Docker images
	docker rmi $(FULL_IMAGE) 2>/dev/null || true

all: build push deploy ## Build, push, and deploy

# Development targets
dev-deploy: deploy port-forward ## Deploy and start port-forwarding

# Health check
health: ## Check health endpoint
	@echo "Checking health endpoint..."
	kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
		curl http://webclient-document-upload/api/health
