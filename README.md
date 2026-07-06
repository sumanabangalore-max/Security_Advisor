# 🛡️ Security Advisory Tracker & Outbreak Response Center

A high-fidelity, production-ready full-stack Security Dashboard for CMDB systems. This system manages your local software inventory, correlates matches against live environments, tracks active CVE threats, and introduces a **State-of-the-Art Zero-Day Threat Outbreak Control Panel** with **Autonomous AI Patching Agent** simulation and live scrolling CLI consoles.

---

## 🔥 Featured: Zero-Day Threat & Outbreak Management
This release introduces advanced capabilities designed to handle high-profile zero-day exploits (e.g., Log4Shell, Heartbleed-NG) that have active exploits circulating in the wild before vendor patches are available.
* **Outbreak Highlighting Banner**: A glowing, high-contrast alert panel pinning active zero-days at the very top of the analyst dashboard.
* **Technical Workaround Playbooks**: Actionable CLI scripts for both Linux/Docker and Windows/PowerShell environments to contain threats immediately.
* **Autonomous Virtual Patching**: An interactive, one-click **AI Patching Agent** that logs remote terminal operations (package updates, module disabling, and configuration validation) inside a simulated scrolling console, successfully mitigating the threat in real-time.

---

## 🏗️ System Topology & Services

The application consists of five Docker services defined in `docker-compose.yml`:

| Service | Container Name | Role | Port |
| :--- | :--- | :--- | :--- |
| **postgres** | `cve-tracker-db` | Relational PostgreSQL 16 database | `5432` |
| **bootstrap** | `cve-tracker-bootstrap` | One-shot job syncing inventory files from the `inventory/` directory | - |
| **backend** | `cve-tracker-api` | Python FastAPI REST & WebSocket server | `8000` |
| **worker** | `cve-tracker-worker` | Python background worker syncing NVD CVEs every 24 hours | - |
| **frontend** | `cve-tracker-ui` | React + TypeScript + Tailwind single page application served by nginx | `5173` |

---

## 💻 Running on Docker Desktop (Localhost)

Follow these steps to build, run, and test the system locally using Docker Desktop:

### Prerequisites
* **Docker Desktop** installed and running on Windows, macOS, or Linux.
* **Git** (optional) to clone the repository.

### 1. Build and Launch Services
Spin up the complete full-stack environment in detached mode:
```bash
docker compose up -d --build
```
*Docker will pull base images, install Python/Node dependencies, compile the React production bundles, and set up local networking.*

### 2. Seed Default Administrator Credentials
Seed the Postgres database with default user accounts and a secure, cryptographically random password:
```bash
docker compose exec backend python scripts/seed_admin.py
```
*Note: Make sure to copy the generated admin password printed to the terminal!*

### 3. Access the Dashboard
Open your web browser and go to:
* **UI Portal**: `http://localhost:5173`
* **API Swagger Docs**: `http://localhost:8000/docs`

Log in using `admin` and the generated password from step 2. You can trigger scans, manage inventory files, assign engineers, and deploy the AI Patching Agent live!

### Setup Teardown
To stop all containers while preserving database volume records:
```bash
docker compose down
```
To stop containers and completely wipe all Postgres data (starting fresh):
```bash
docker compose down -v
```

---

## ☁️ Deploying to Public Cloud Environments

Ready to move from local development to production? Here is how to migrate this containerized full-stack architecture to AWS and Azure:

### 1. Deploying to AWS (Amazon Web Services)

The fastest and most robust way to deploy this on AWS is using **Amazon ECS (Elastic Container Service) on AWS Fargate** (Serverless Containers) with an **Amazon RDS PostgreSQL** database:

#### Step A: Database Setup
1. Spin up an **Amazon RDS for PostgreSQL** database instance in your private subnet.
2. Note down the Database Host connection string, DB User, and password.

#### Step B: Build and Push Images to Amazon ECR (Elastic Container Registry)
Create ECR repositories for the backend, frontend, and worker images:
```bash
# Authenticate Docker to your AWS Account
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com

# Build and Tag your images
docker build -t cve-tracker-backend ./backend
docker tag cve-tracker-backend:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/cve-tracker-backend:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/cve-tracker-backend:latest

docker build -t cve-tracker-frontend ./frontend
docker tag cve-tracker-frontend:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/cve-tracker-frontend:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/cve-tracker-frontend:latest
```

#### Step C: Define ECS Task Definition and Run
1. Create a task definition specifying your backend, frontend, and worker containers.
2. In the Backend and Worker container specifications, inject environment variables pointing to your RDS connection string:
   * `DATABASE_URL=postgresql://<db_user>:<db_password>@<rds_endpoint>:5432/<db_name>`
   * `JWT_SECRET=<your_secure_jwt_key>`
3. Set up an **Application Load Balancer (ALB)** to route port `80` traffic to the frontend container, and proxy `/api/*` and `/ws/*` requests to your backend service.

---

### 2. Deploying to Azure (Microsoft Azure)

The best serverless option on Azure is **Azure Container Apps (ACA)**, which supports multi-container communication via environment ingress and Dapr natively:

#### Step A: Database Setup
1. Deploy an **Azure Database for PostgreSQL Flexible Server**.
2. Configure network firewall rules to allow connections from other Azure services.

#### Step B: Push Images to Azure Container Registry (ACR)
```bash
# Login to Azure and your Registry
az login
az acr login --name <your_acr_name>

# Tag and push images
docker tag cve-tracker-backend:latest <your_acr_name>.azurecr.io/cve-tracker-backend:latest
docker push <your_acr_name>.azurecr.io/cve-tracker-backend:latest

docker tag cve-tracker-frontend:latest <your_acr_name>.azurecr.io/cve-tracker-frontend:latest
docker push <your_acr_name>.azurecr.io/cve-tracker-frontend:latest
```

#### Step C: Deploy Container Apps
1. Create an **Azure Container Apps Environment** with a virtual network.
2. Deploy the **Backend container app**:
   * Enable ingress (target port `8000`), restricted to internal VNet traffic or open depending on your requirements.
   * Add environment secrets for `DATABASE_URL` pointing to your Azure Postgres.
3. Deploy the **Frontend container app**:
   * Enable external ingress (target port `80` / `8080`).
   * Add env variable `BACKEND_URL` pointing to your Backend Container App internal address.
4. Deploy the **Worker background container app** (ingress disabled).

---

## 🚀 LinkedIn Launch Template (Copy & Paste)

Use this highly engaging, modern post template to share your Security Advisory Tracker on LinkedIn and showcase your expertise in cloud-native application design, devops, and security orchestration!

```text
🚀 Exciting Project Share: Built and Deployed a Cloud-Native Security Advisory Tracker & Outbreak Response Center!

In today's fast-paced threat landscape, immediate vulnerability visibility and unpatched Zero-Day response is everything. Traditional passive scanners identify issues, but they leave security analysts without clear immediate action playbooks or automated remediation pathways.

To address this, I built the 🛡️ Security Advisory Tracker — a containerized, full-stack SecOps platform designed to identify, match, and contain vulnerabilities across corporate CMDB records in real-time.

Here are the key capabilities I designed into this platform:
🔥 Active Zero-Day Outbreak Center: Visually highlights active zero-day threats (like unpatched RCEs) and presents critical CLI mitigation workarounds for immediate threat containment.
⚡ One-Click Autonomous Virtual Patching: Features an interactive AI Patch Agent that simulates SSH target connectivity, analyzes package dependencies, and updates host configurations live inside a retro-scrolling terminal window.
📊 Advanced Spreadsheet Reporting: Filter vulnerabilities by cvss score, publish age, environment, and owner, then export clean CSVs with custom engineer assignments.
🐳 Full Multi-Service Docker Architecture: Composes a Postgres 16 database, FastAPI Python server, React + Vite SPA, nginx reverse proxy, and a background CVE Crawler daemon.

Ready to run or deploy? I've open-sourced the entire project along with comprehensive guides to spin it up locally in Docker Desktop or scale it to Azure Container Apps (ACA) and AWS ECS on Fargate.

Check out the repository, run the compose files, and let me know your thoughts!

#DevOps #Cybersecurity #FullStack #Docker #CloudComputing #FastAPI #ReactJS #AWS #Azure #OpenSource
```
