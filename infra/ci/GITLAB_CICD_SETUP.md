# GitLab CI/CD Setup Guide

This guide explains how to set up the GitLab CI/CD pipeline for automated Docker builds and Kubernetes deployments.

## Overview

The pipeline consists of two main stages:

1. **Build**: Builds the Docker image and pushes it to your private registry
2. **Deploy**: Deploys the application to Kubernetes (dev/production environments)

## Prerequisites

Before setting up the pipeline, ensure you have:

- GitLab Runner configured with Docker and Kubernetes support
- Access to your private Docker registry (`registry.sycapt.com:32547`)
- Kubernetes cluster with kubectl access
- Database (PostgreSQL) running and accessible from K8s cluster

## GitLab CI/CD Variables Setup

### Required Variables

Navigate to your GitLab project: **Settings > CI/CD > Variables**

Add the following variables:

#### Docker Registry Variables

| Variable Name | Value | Protected | Masked | Description |
|--------------|-------|-----------|---------|-------------|
| `DOCKER_REGISTRY_USER` | `<your-registry-username>` | ✓ | ✓ | Docker registry username |
| `DOCKER_REGISTRY_PASSWORD` | `<your-registry-password>` | ✓ | ✓ | Docker registry password |

#### Kubernetes Configuration Variables

| Variable Name | Value | Protected | Masked | Type | Description |
|--------------|-------|-----------|---------|------|-------------|
| `KUBE_CONFIG_DEV` | `<base64-encoded-kubeconfig>` | ✓ | ✗ | File | Development K8s config |
| `KUBE_CONFIG_PROD` | `<base64-encoded-kubeconfig>` | ✓ | ✗ | File | Production K8s config |

### How to Generate Kubernetes Config Variables

#### Method 1: From existing kubeconfig file

```bash
# Encode your kubeconfig file
cat ~/.kube/config | base64 -w 0

# Or on macOS
cat ~/.kube/config | base64
```

Copy the output and paste it as the value for `KUBE_CONFIG_DEV` or `KUBE_CONFIG_PROD`.

#### Method 2: Create service account with kubectl

```bash
# 1. Create a service account
kubectl create serviceaccount gitlab-deploy -n default

# 2. Create a cluster role binding
kubectl create clusterrolebinding gitlab-deploy-binding \
  --clusterrole=cluster-admin \
  --serviceaccount=default:gitlab-deploy

# 3. Get the service account token
kubectl create token gitlab-deploy -n default --duration=87600h

# 4. Get cluster info
kubectl config view --minify --flatten

# 5. Create kubeconfig file (replace placeholders)
cat > kubeconfig-gitlab.yaml <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: <CA_DATA>
    server: <KUBERNETES_API_SERVER>
  name: gitlab-cluster
contexts:
- context:
    cluster: gitlab-cluster
    user: gitlab-deploy
    namespace: default
  name: gitlab-context
current-context: gitlab-context
users:
- name: gitlab-deploy
  user:
    token: <SERVICE_ACCOUNT_TOKEN>
EOF

# 6. Encode and add to GitLab
cat kubeconfig-gitlab.yaml | base64 -w 0
```

## Pipeline Configuration

### Branch Strategy

The pipeline is configured to work with the following branches:

- **`dev`**: Automatically deploys to development environment
- **`main`**: Builds images, manual deployment to production
- **`tags`**: Builds tagged releases, manual deployment to production

### Deployment Strategy

- **Development**: Automatic deployment on push to `dev` branch
- **Production**: Manual deployment (requires approval) from `main` branch or tags

### Docker Image Tagging

Each build creates three tags:

1. `${CI_COMMIT_SHORT_SHA}` - Git commit hash (e.g., `a1b2c3d`)
2. `${CI_COMMIT_REF_SLUG}` - Branch name (e.g., `dev`, `main`)
3. `latest` - Always points to the most recent build

## Kubernetes Setup

### 1. Create Image Pull Secret

If not already created, create a secret for pulling from your private registry:

```bash
kubectl create secret docker-registry private-registry-secret \
  --docker-server=registry.sycapt.com:32547 \
  --docker-username=<your-username> \
  --docker-password=<your-password> \
  --docker-email=<your-email> \
  -n default
```

### 2. Apply Kubernetes Manifests

```bash
# Apply all manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Or use kustomize
kubectl apply -k k8s/
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n default -l app=webclient-chat

# Check service
kubectl get svc -n default -l app=webclient-chat

# View logs
kubectl logs -f deployment/webclient-chat -n default
```

## GitLab Runner Configuration

### Required Runner Tags

Ensure your GitLab runners have the following tags:

- `docker` - For Docker build jobs
- `kubernetes` - For Kubernetes deployment jobs

### Runner Configuration Example

```toml
[[runners]]
  name = "docker-runner"
  url = "https://gitrepo.sycapt.com:10990/"
  token = "YOUR_RUNNER_TOKEN"
  executor = "docker"
  [runners.docker]
    image = "docker:24-dind"
    privileged = true
    volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache"]
  [runners.cache]
    [runners.cache.s3]
    [runners.cache.gcs]
  tags = ["docker"]

[[runners]]
  name = "kubernetes-runner"
  url = "https://gitrepo.sycapt.com:10990/"
  token = "YOUR_RUNNER_TOKEN"
  executor = "kubernetes"
  tags = ["kubernetes"]
```

## Manual Deployment

### Deploy to Development

```bash
# Option 1: Via GitLab UI
# Go to: CI/CD > Pipelines > Click on pipeline > Click "deploy:dev"

# Option 2: Via kubectl
kubectl set image deployment/webclient-chat \
  webclient-chat=registry.sycapt.com:32547/webclient-document-uploader:latest \
  -n default

kubectl rollout status deployment/webclient-chat -n default
```

### Deploy to Production

```bash
# Option 1: Via GitLab UI (Recommended)
# Go to: CI/CD > Pipelines > Click on pipeline > Click "deploy:production" (Manual)

# Option 2: Via kubectl
kubectl set image deployment/webclient-chat \
  webclient-chat=registry.sycapt.com:32547/webclient-document-uploader:a1b2c3d \
  -n default

kubectl rollout status deployment/webclient-chat -n default
```

## Rollback Deployment

### Via GitLab UI

1. Navigate to: **Deployments > Environments**
2. Find the environment (development/production)
3. Click "Rollback" or use the "stop" job

### Via kubectl

```bash
# Rollback to previous version
kubectl rollout undo deployment/webclient-chat -n default

# Rollback to specific revision
kubectl rollout history deployment/webclient-chat -n default
kubectl rollout undo deployment/webclient-chat --to-revision=2 -n default
```

## Monitoring and Troubleshooting

### View Pipeline Logs

```bash
# GitLab UI: CI/CD > Pipelines > Click on job
```

### Check Pod Logs

```bash
# Real-time logs
kubectl logs -f deployment/webclient-chat -n default

# Previous pod logs (if crashed)
kubectl logs deployment/webclient-chat -n default --previous

# Multiple pods
kubectl logs -l app=webclient-chat -n default --tail=100
```

### Check Pod Status

```bash
# Describe pod for events and errors
kubectl describe pod <pod-name> -n default

# Get pod details
kubectl get pod <pod-name> -n default -o yaml
```

### Common Issues

#### 1. ImagePullBackOff

**Problem**: Cannot pull Docker image from registry

**Solution**:
```bash
# Verify image exists
docker pull registry.sycapt.com:32547/webclient-document-uploader:latest

# Check image pull secret
kubectl get secret private-registry-secret -n default

# Recreate secret if needed
kubectl delete secret private-registry-secret -n default
kubectl create secret docker-registry private-registry-secret \
  --docker-server=registry.sycapt.com:32547 \
  --docker-username=<username> \
  --docker-password=<password>
```

#### 2. CrashLoopBackOff

**Problem**: Application crashes immediately after starting

**Solution**:
```bash
# Check logs
kubectl logs deployment/webclient-chat -n default

# Common causes:
# - Database connection failed (check DB_* env vars in secret)
# - Missing environment variables
# - Python dependencies not installed in Docker image
```

#### 3. Pipeline Build Fails

**Problem**: Docker build fails in GitLab CI

**Solution**:
- Check GitLab CI logs for specific error
- Verify Docker registry credentials
- Ensure GitLab runner has Docker executor
- Check if runner has enough disk space

## Environment URLs

After deployment, access your application at:

- **Development**: http://webclient-chat.dev.sycapt.com (or NodePort: http://<node-ip>:32001)
- **Production**: http://webclient-chat.sycapt.com

## Security Best Practices

1. **Never commit secrets** to Git (use GitLab CI/CD variables)
2. **Use protected branches** for `main` and `dev`
3. **Enable manual approval** for production deployments
4. **Rotate credentials** regularly
5. **Use RBAC** for Kubernetes service accounts
6. **Scan Docker images** for vulnerabilities
7. **Use network policies** to restrict pod communication

## Additional Resources

- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Docker Build Documentation](https://docs.docker.com/engine/reference/commandline/build/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
