# Cloud Portability & Deployment Guide: AWS EKS & Azure AKS

This guide describes how to deploy the **SEC_ADVISOR (CVE Tracker)** enterprise architecture from the local IDE sandbox environment into production cloud providers (**AWS EKS** and **Azure Container Service / AKS**) with fully managed PaaS relational databases (**Amazon RDS** or **Azure Database for PostgreSQL**).

---

## 1. Architectural Overview

The application is structured into four highly modular microservices to facilitate container orchestration and easy scale-out:

1. **Frontend UI (Node.js/Express + React/Vite)**: Serves static assets, routes UI page traffic, and manages proxy requests.
2. **Backend API (Python FastAPI)**: Handles business logic, vulnerability mapping, and ingest flows.
3. **Background Worker (Python)**: Continuously polls vulnerability sources (NIST NVD) and syncs security profiles.
4. **Relational Database (PostgreSQL)**: Serves as the central transaction database.

---

## 2. Moving to PaaS Database Services

In your local container environment, the PostgreSQL service is hosted in a Docker container (`postgres:16-alpine`). For production, this should be moved to a fully managed PaaS (Platform-as-a-Service) instance:

* **AWS**: Amazon RDS for PostgreSQL or Amazon Aurora PostgreSQL.
* **Azure**: Azure Database for PostgreSQL Flexible Server.

### Connection Configuration
The application leverages the standard `DATABASE_URL` environment variable. To connect to your cloud PaaS database, you simply swap the connection string. No code modifications are required:

```bash
# Template format:
postgresql://<USER>:<PASSWORD>@<PAAS_HOST>:<PORT>/<DATABASE_NAME>[?sslmode=require]

# Example AWS RDS connection string:
postgresql://db_admin:prodSecurePassword123@cve-tracker-prod.c123456789.us-east-1.rds.amazonaws.com:5432/cvetracker?sslmode=require
```

---

## 3. Kubernetes Manifests (AWS EKS & Azure AKS)

Below are the production-ready Kubernetes resource manifests to deploy the platform. You can apply these manifests using `kubectl apply -f manifests/` or package them into a Helm chart.

### A. Secrets & Configurations (`secrets.yaml`)
Create a secure credentials file representing your PaaS credentials, API keys, and JWT tokens:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cve-tracker-secrets
  namespace: security-advisor
type: Opaque
stringData:
  # Managed DB PaaS endpoint
  DATABASE_URL: "postgresql://db_admin:prodSecurePassword123@cve-tracker-prod.c123456789.us-east-1.rds.amazonaws.com:5432/cvetracker?sslmode=require"
  # Security configurations
  JWT_SECRET: "prod-jwt-secret-token-replace-in-pipeline"
  # Google Gemini AI model API key
  GEMINI_API_KEY: "AIzaSy..."
  # Local Ollama endpoint within the Kubernetes cluster
  OLLAMA_HOST: "http://ollama-service.security-advisor.svc.cluster.local:11434"
  OLLAMA_MODEL: "gemma2"
```

---

### B. Backend API Deployment (`backend-deployment.yaml`)
Deploys the Python FastAPI microservice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cve-tracker-api
  namespace: security-advisor
  labels:
    app: cve-tracker-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cve-tracker-api
  template:
    metadata:
      labels:
        app: cve-tracker-api
    spec:
      containers:
      - name: api
        image: <YOUR_REGISTRY_URI>/cve-tracker-backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
        envFrom:
        - secretRef:
            name: cve-tracker-secrets
        resources:
          limits:
            cpu: "1"
            memory: 1Gi
          requests:
            cpu: 500m
            memory: 512Mi
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: cve-tracker-api-service
  namespace: security-advisor
spec:
  ports:
  - port: 8000
    targetPort: 8000
  selector:
    app: cve-tracker-api
  type: ClusterIP
```

---

### C. Frontend UI Deployment (`frontend-deployment.yaml`)
Deploys the Node.js / Express custom fullstack wrapper serving the React web interface:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cve-tracker-ui
  namespace: security-advisor
  labels:
    app: cve-tracker-ui
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cve-tracker-ui
  template:
    metadata:
      labels:
        app: cve-tracker-ui
    spec:
      containers:
      - name: ui
        image: <YOUR_REGISTRY_URI>/cve-tracker-fullstack:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: cve-tracker-secrets
        resources:
          limits:
            cpu: "500m"
            memory: 512Mi
          requests:
            cpu: 250m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: cve-tracker-ui-service
  namespace: security-advisor
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: cve-tracker-ui
  type: LoadBalancer
```

---

### D. Background Worker Deployment (`worker-deployment.yaml`)
Deploys the singleton background worker checking security updates:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cve-tracker-worker
  namespace: security-advisor
  labels:
    app: cve-tracker-worker
spec:
  replicas: 1 # Standard singleton to avoid race conditions
  selector:
    matchLabels:
      app: cve-tracker-worker
  template:
    metadata:
      labels:
        app: cve-tracker-worker
    spec:
      containers:
      - name: worker
        image: <YOUR_REGISTRY_URI>/cve-tracker-backend:latest
        command: ["python", "app/worker.py"]
        envFrom:
        - secretRef:
            name: cve-tracker-secrets
        resources:
          limits:
            cpu: "500m"
            memory: 512Mi
          requests:
            cpu: 200m
            memory: 256Mi
```

---

### E. Kubernetes Deployment of Local Ollama (Optional)
If you wish to deploy Ollama with **Gemma2** inside the same Kubernetes cluster to save costs, you can launch it inside EKS/AKS with GPU nodes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: security-advisor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          limits:
            nvidia.com/gpu: "1" # Optional if using GPU nodes for acceleration
```

---

## 4. Deploying with CI/CD (GitHub Actions / GitLab CI)

To deploy to Azure AKS or AWS EKS automatically:

1. **Build and Tag**: Build Docker images for both `Dockerfile` roots (backend and frontend).
2. **Push to Container Registry**: Push to AWS ECR or Azure Container Registry (ACR).
3. **Update Manifests**: Update image tags inside the Deployment manifests.
4. **Apply with Credentials**: Authenticate with Azure CLI / AWS CLI and run:
   ```bash
   az aks get-credentials --resource-group prod-rg --name prod-aks-cluster
   # OR
   aws eks update-kubeconfig --region us-east-1 --name prod-eks-cluster
   
   kubectl apply -f k8s/
   ```

With this infrastructure, migrating environments is as simple as updating your `DATABASE_URL` and `GEMINI_API_KEY`/`OLLAMA_HOST` secrets inside Kubernetes.
