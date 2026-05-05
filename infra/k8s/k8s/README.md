# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the Webclient Document Upload application.

## Prerequisites

1. A running Kubernetes cluster
2. `kubectl` CLI tool installed and configured
3. Docker registry access (for pushing container images)
4. PostgreSQL database accessible from the cluster
5. Ollama service accessible from the cluster

## Files Overview

- `deployment.yaml` - Main application deployment configuration
- `service.yaml` - Service to expose the application
- `configmap.yaml` - Non-sensitive configuration values
- `secret.yaml` - Sensitive configuration (database credentials)
- `ingress.yaml` - (Optional) Ingress for external access
- `pvc.yaml` - (Optional) Persistent storage for uploads

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t your-registry/webclient-document-upload:latest .

# Push to your container registry
docker push your-registry/webclient-document-upload:latest
```

### 2. Update Configuration

#### Update Secret (k8s/secret.yaml)
Edit the database credentials and other sensitive values:
```bash
vim k8s/secret.yaml
```

**IMPORTANT**: Never commit actual secrets to version control!

#### Update ConfigMap (k8s/configmap.yaml)
Adjust the Ollama host and other configuration values:
```bash
vim k8s/configmap.yaml
```

#### Update Deployment (k8s/deployment.yaml)
Update the image reference to match your registry:
```yaml
spec:
  containers:
  - name: document-upload-app
    image: your-registry/webclient-document-upload:latest  # Update this
```

#### Update Ingress (k8s/ingress.yaml)
If using Ingress, update the hostname:
```yaml
rules:
- host: your-domain.com  # Update this
```

### 3. Deploy to Kubernetes

#### Option A: Deploy all resources at once
```bash
kubectl apply -f k8s/
```

#### Option B: Deploy step by step
```bash
# 1. Create ConfigMap and Secret first
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 2. Create PVC (if using persistent storage)
kubectl apply -f k8s/pvc.yaml

# 3. Deploy the application
kubectl apply -f k8s/deployment.yaml

# 4. Create the service
kubectl apply -f k8s/service.yaml

# 5. (Optional) Create Ingress
kubectl apply -f k8s/ingress.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=webclient-document-upload

# Check service
kubectl get svc webclient-document-upload

# Check logs
kubectl logs -f deployment/webclient-document-upload

# Describe pod for troubleshooting
kubectl describe pod -l app=webclient-document-upload
```

### 5. Access the Application

#### Via Port Forward (for testing)
```bash
kubectl port-forward svc/webclient-document-upload 8080:80
# Access at http://localhost:8080
```

#### Via LoadBalancer
If using LoadBalancer service type:
```bash
kubectl get svc webclient-document-upload-lb
# Access via EXTERNAL-IP
```

#### Via Ingress
If using Ingress, access via the configured domain.

## Configuration Details

### Environment Variables

#### From ConfigMap
- `PORT` - Server port (default: 3001)
- `OLLAMA_HOST` - Ollama service endpoint
- `OLLAMA_MODEL` - Embedding model
- `OLLAMA_VISION_MODEL` - Vision model
- `OLLAMA_CHAT_MODEL` - Chat model
- `OLLAMA_RERANKER_MODEL` - Reranker model
- `PYTHON_PATH` - Python executable path

#### From Secret
- `DB_HOST` - PostgreSQL host
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DB_PORT` - Database port

### Resource Limits

Current configuration:
- **Requests**: 512Mi RAM, 250m CPU
- **Limits**: 2Gi RAM, 1000m CPU

Adjust based on your workload in `deployment.yaml`.

### Persistent Storage

The deployment includes an `emptyDir` volume by default, which is ephemeral.

For persistent uploads storage:
1. Apply the PVC: `kubectl apply -f k8s/pvc.yaml`
2. Update `deployment.yaml` to use PVC instead of emptyDir:
```yaml
volumes:
- name: uploads
  persistentVolumeClaim:
    claimName: document-uploads-pvc
```

## Health Checks

The deployment includes:
- **Liveness Probe**: Checks if the app is running (path: `/api/health`)
- **Readiness Probe**: Checks if the app is ready to serve traffic (path: `/api/health`)

Note: Ensure your server has a health check endpoint at `/api/health`.

## Scaling

Scale the deployment:
```bash
# Scale to 3 replicas
kubectl scale deployment webclient-document-upload --replicas=3

# Auto-scale based on CPU
kubectl autoscale deployment webclient-document-upload --min=2 --max=10 --cpu-percent=70
```

## Troubleshooting

### Pods not starting
```bash
# Check events
kubectl describe pod -l app=webclient-document-upload

# Check logs
kubectl logs -l app=webclient-document-upload --tail=100
```

### Database connection issues
```bash
# Verify secrets
kubectl get secret app-secrets -o yaml

# Test database connectivity from pod
kubectl exec -it deployment/webclient-document-upload -- sh
# Inside pod:
# nc -zv $DB_HOST $DB_PORT
```

### Image pull errors
```bash
# Check image pull secrets
kubectl get pods -l app=webclient-document-upload -o yaml | grep imagePullSecrets

# Add image pull secret if needed
kubectl create secret docker-registry regcred \
  --docker-server=your-registry \
  --docker-username=your-username \
  --docker-password=your-password
```

## Cleanup

Remove all resources:
```bash
kubectl delete -f k8s/
```

## Security Recommendations

1. **Secrets Management**: Use external secret managers (e.g., HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
2. **RBAC**: Implement proper Role-Based Access Control
3. **Network Policies**: Restrict network access between pods
4. **Image Security**: Use private registries and scan images for vulnerabilities
5. **TLS**: Enable TLS/SSL for Ingress endpoints
6. **Resource Limits**: Always set resource limits to prevent resource exhaustion

## Production Considerations

1. **High Availability**: Run multiple replicas (already configured: 2 replicas)
2. **Monitoring**: Integrate with Prometheus/Grafana
3. **Logging**: Use centralized logging (ELK, Loki, etc.)
4. **Backup**: Regular backups of persistent volumes and database
5. **CI/CD**: Automate deployments with GitOps (ArgoCD, Flux)
6. **Pod Disruption Budget**: Ensure availability during updates
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: webclient-document-upload-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: webclient-document-upload
```

## Support

For issues and questions, refer to the main project README.md
