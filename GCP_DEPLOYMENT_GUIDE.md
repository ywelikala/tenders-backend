# Google Cloud Platform Deployment Guide

This guide will help you deploy the Tender Portal Backend to Google Cloud Platform using Cloud Run.

## 🚀 Quick Deployment Options

### Option 1: Automated GitHub Actions (Recommended)
- Push to main branch triggers automatic deployment
- Zero manual configuration after initial setup

### Option 2: Manual Deployment Script
- Run the deployment script locally
- More control over the deployment process

### Option 3: Manual Commands
- Step-by-step manual deployment
- Best for learning and troubleshooting

---

## 📋 Prerequisites

### 1. Google Cloud Account Setup
- Create a Google Cloud account: https://cloud.google.com/
- Create a new project or use an existing one
- Enable billing for your project

### 2. Local Tools (for manual deployment)
- Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Install Docker: https://docs.docker.com/get-docker/
- Clone this repository locally

### 3. Required Information
- **MongoDB Atlas URI**: Your connection string
- **JWT Secret**: A secure random string for token signing
- **System User Password**: Password for system operations

---

## 🎯 Option 1: Automated Deployment (GitHub Actions)

### Step 1: Set up Service Account

1. **Create Service Account**
   ```bash
   # Set your project ID
   export PROJECT_ID="your-project-id"
   
   # Create service account
   gcloud iam service-accounts create tenders-backend-deploy \
     --display-name="Tenders Backend Deployment" \
     --project=$PROJECT_ID
   ```

2. **Grant Permissions**
   ```bash
   # Grant necessary roles
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:tenders-backend-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:tenders-backend-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:tenders-backend-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.admin"
   
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:tenders-backend-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```

3. **Generate Service Account Key**
   ```bash
   gcloud iam service-accounts keys create key.json \
     --iam-account=tenders-backend-deploy@$PROJECT_ID.iam.gserviceaccount.com
   ```

### Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID | `my-project-12345` |
| `GCP_SA_KEY` | Content of the service account key.json file | `{"type": "service_account"...}` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secure random string for JWT signing | `your-super-secure-jwt-secret-key` |
| `SYSTEM_USER_PASSWORD` | Password for system operations | `secure-system-password` |

### Step 3: Enable APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 4: Deploy

Push to main branch or manually trigger the workflow:
- Go to Actions tab in GitHub
- Select "Deploy to Google Cloud Platform"
- Click "Run workflow"

---

## 🛠️ Option 2: Script Deployment

### Step 1: Prepare Environment

```bash
# Clone repository
git clone https://github.com/ywelikala/tenders-backend.git
cd tenders-backend

# Make script executable
chmod +x gcp/deploy.sh

# Set up authentication
gcloud auth login
gcloud auth application-default login
```

### Step 2: Run Deployment Script

```bash
# Run the deployment script
./gcp/deploy.sh
```

The script will prompt you for:
- Google Cloud Project ID
- MongoDB Atlas URI
- JWT Secret
- System User Password

### Step 3: Verify Deployment

```bash
# Check service status
gcloud run services describe tenders-backend --region us-central1

# Test the deployment
curl https://your-service-url/api/health
```

---

## ⚙️ Option 3: Manual Deployment

### Step 1: Set Environment Variables

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="tenders-backend"
export MONGODB_URI="your-mongodb-uri"
export JWT_SECRET="your-jwt-secret"
export SYSTEM_USER_PASSWORD="your-password"
```

### Step 2: Enable APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 3: Create Secrets

```bash
# MongoDB URI
echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=-

# JWT Secret
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# System User Password
echo -n "$SYSTEM_USER_PASSWORD" | gcloud secrets create system-user-password --data-file=-
```

### Step 4: Build and Deploy

```bash
# Build using Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
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
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `production` |
| `PORT` | Server port | `3000` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `SYSTEM_USER_EMAIL` | System user email | `system@tenders.lk` |

### Resource Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| **Memory** | 1Gi | RAM allocation |
| **CPU** | 1 vCPU | Processing power |
| **Min Instances** | 0 | Scale to zero when idle |
| **Max Instances** | 10 | Maximum concurrent instances |
| **Concurrency** | 80 | Requests per instance |
| **Timeout** | 300s | Request timeout |

### Scaling Behavior

- **Scale to Zero**: Instances shut down when no traffic (saves costs)
- **Cold Start**: ~2-3 seconds for first request after idle
- **Auto-scaling**: Automatically adds instances under load
- **Traffic Splitting**: Supports gradual rollouts

---

## 📊 Monitoring & Management

### View Logs

```bash
# Real-time logs
gcloud run logs tail --service=tenders-backend --region=us-central1

# Recent logs
gcloud run logs read --service=tenders-backend --region=us-central1 --limit=100
```

### Service Management

```bash
# Get service details
gcloud run services describe tenders-backend --region=us-central1

# Update service
gcloud run deploy tenders-backend --region=us-central1 --image=gcr.io/$PROJECT_ID/tenders-backend:latest

# Delete service
gcloud run services delete tenders-backend --region=us-central1
```

### Monitoring Dashboard

Access Google Cloud Console → Cloud Run → tenders-backend for:
- Request metrics
- Response times
- Error rates
- CPU and memory usage
- Scaling events

---

## 💰 Cost Estimation

### Cloud Run Pricing (US-Central1)
- **CPU**: $0.00002400 per vCPU-second
- **Memory**: $0.00000250 per GiB-second
- **Requests**: $0.40 per million requests
- **Free Tier**: 2 million requests, 400,000 GiB-seconds, 200,000 vCPU-seconds per month

### Example Monthly Costs
- **Low Traffic** (10K requests): ~$0.50-2.00
- **Medium Traffic** (100K requests): ~$5-15
- **High Traffic** (1M requests): ~$40-80

### Cost Optimization
- Service scales to zero when idle (no charges)
- Use appropriate CPU/memory sizing
- Monitor with Cloud Billing alerts

---

## 🛡️ Security Features

### Network Security
- HTTPS by default (SSL/TLS)
- Google Cloud's global load balancer
- DDoS protection included

### Application Security
- Secrets stored in Secret Manager
- No hardcoded credentials
- Container runs as non-root user
- Security headers with Helmet.js

### Access Control
- IAM-based permissions
- Service account isolation
- Audit logging enabled

---

## 🔄 CI/CD Pipeline

### Automated Workflow
1. **Code Push** → Triggers GitHub Action
2. **Build** → Docker image creation
3. **Security Scan** → Vulnerability checking
4. **Deploy** → Cloud Run deployment
5. **Test** → Health check validation
6. **Notify** → Deployment status

### Manual Triggers
- GitHub Actions can be manually triggered
- Supports environment selection (staging/production)
- Rollback capabilities

---

## 🚨 Troubleshooting

### Common Issues

#### 1. Deployment Fails
```bash
# Check build logs
gcloud builds log [BUILD_ID]

# Check service logs
gcloud run logs read --service=tenders-backend --region=us-central1
```

#### 2. Health Check Fails
- Verify `/api/health` endpoint responds
- Check if MongoDB connection is working
- Validate environment variables and secrets

#### 3. Memory/CPU Issues
```bash
# Increase resources
gcloud run deploy tenders-backend \
  --memory=2Gi \
  --cpu=2 \
  --region=us-central1
```

#### 4. Secret Access Issues
```bash
# Verify secrets exist
gcloud secrets list

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID
```

### Debug Commands

```bash
# Service status
gcloud run services describe tenders-backend --region=us-central1

# Recent deployments
gcloud run revisions list --service=tenders-backend --region=us-central1

# Traffic allocation
gcloud run services describe tenders-backend --region=us-central1 --format="value(status.traffic[].percent,status.traffic[].revisionName)"
```

---

## 📞 Support

### Documentation
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)

### Community
- [Google Cloud Community](https://cloud.google.com/community)
- [Stack Overflow - google-cloud-platform](https://stackoverflow.com/questions/tagged/google-cloud-platform)

### Repository Issues
For application-specific issues, create an issue in this repository.

---

## 🎉 Success!

After deployment, your Tender Portal Backend will be running on Google Cloud Run with:

- ✅ **Automatic HTTPS** with managed certificates
- ✅ **Global CDN** for fast response times
- ✅ **Auto-scaling** based on traffic
- ✅ **Zero-downtime deployments**
- ✅ **Integrated monitoring** and logging
- ✅ **Cost-effective** pay-per-use pricing

Your API will be accessible at: `https://tenders-backend-[hash]-uc.a.run.app`

Test your deployment: `curl https://your-service-url/api/health`