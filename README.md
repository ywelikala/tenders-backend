# Tender Portal Backend API

Backend API for the Tender Portal application built with Node.js, Express, and MongoDB Atlas.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Tender Management**: Complete CRUD operations with advanced filtering
- **User Management**: Registration, login, profile management
- **File Uploads**: Document and profile image handling
- **Subscription System**: Multi-tier subscription management
- **MongoDB Atlas**: Cloud database integration
- **Comprehensive Testing**: 80%+ test coverage
- **Production Ready**: Logging, error handling, rate limiting, security middleware

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Authentication**: JWT
- **File Processing**: Multer, Sharp
- **Testing**: Jest, Supertest
- **Logging**: Winston
- **Security**: Helmet, Rate Limiting, Input Validation

## ☁️ Cloud Deployment

### Google Cloud Platform (Recommended)

Deploy to Google Cloud Run with automatic scaling and managed infrastructure:

```bash
# Quick deployment using our script
./gcp/deploy.sh

# Or use GitHub Actions for automated CI/CD
# See GCP_DEPLOYMENT_GUIDE.md for detailed instructions
```

**Features:**
- ✅ Auto-scaling (scale to zero when idle)
- ✅ Managed HTTPS with global CDN
- ✅ Pay-per-use pricing (~$1-5/month for low traffic)
- ✅ Integrated monitoring and logging
- ✅ Zero-downtime deployments

📖 **[Complete GCP Deployment Guide](GCP_DEPLOYMENT_GUIDE.md)**

### Other Cloud Platforms

The Docker images work on any container platform:
- **AWS**: ECS, Fargate, Elastic Beanstalk
- **Azure**: Container Instances, App Service
- **DigitalOcean**: App Platform
- **Heroku**: Container Registry

## 🐳 Docker

### Build Docker Image

```bash
# Build the image
docker build -t tenders-backend .

# Run the container
docker run -p 3000:3000 --env-file .env tenders-backend
```

### Using GitHub Container Registry

The latest Docker images are automatically built and published to GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/ywelikala/tenders-backend:latest

# Run with environment variables
docker run -p 3000:3000 \
  -e MONGODB_URI="your-mongodb-atlas-uri" \
  -e JWT_SECRET="your-jwt-secret" \
  ghcr.io/ywelikala/tenders-backend:latest
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/ywelikala/tenders-backend.git
   cd tenders-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB Atlas URI and other config
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret
JWT_EXPIRES_IN=7d

# System User (for automated operations)
SYSTEM_USER_EMAIL=system@tenders.lk
SYSTEM_USER_PASSWORD=secure_system_password
```

## 🔄 CI/CD Pipeline

This project includes automated CI/CD pipelines using GitHub Actions:

### Workflows

1. **Docker Build and Push** (`.github/workflows/docker-build.yml`)
   - Builds Docker images for AMD64 and ARM64 architectures
   - Pushes to GitHub Container Registry
   - Triggers on push to main branch and tags

2. **Full CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)
   - Runs tests with MongoDB service
   - Security auditing with Snyk
   - Multi-architecture Docker builds
   - Automated deployments to staging/production
   - Image cleanup for untagged versions

### Image Tags

- `latest` - Latest stable build from main branch
- `main` - Latest build from main branch
- `v1.0.0` - Semantic version tags
- `pr-123` - Pull request builds

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Tenders
- `GET /api/tenders` - List tenders with filtering
- `GET /api/tenders/:id` - Get tender by ID
- `POST /api/tenders` - Create new tender
- `PUT /api/tenders/:id` - Update tender
- `DELETE /api/tenders/:id` - Delete tender

### Files
- `POST /api/files/upload` - Upload files
- `GET /api/files/:id` - Download file

### Subscriptions
- `GET /api/subscriptions` - List subscription plans
- `POST /api/subscriptions/subscribe` - Subscribe to plan

### Health Check
- `GET /api/health` - Application health status

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📝 Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run test suite
npm run test:coverage  # Run tests with coverage report
npm run migrate:atlas  # Migrate data from local MongoDB to Atlas
npm run verify:migration  # Verify migration status
```

## 🔧 Production Deployment

### Using Docker

```bash
# Build production image
docker build -t tenders-backend:prod .

# Run with production environment
docker run -d \
  --name tenders-backend \
  -p 3000:3000 \
  --restart unless-stopped \
  --env-file .env.production \
  tenders-backend:prod
```

### Using GitHub Container Registry

```bash
# Pull and run latest production image
docker run -d \
  --name tenders-backend \
  -p 3000:3000 \
  --restart unless-stopped \
  -e MONGODB_URI="$MONGODB_URI" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e NODE_ENV=production \
  ghcr.io/ywelikala/tenders-backend:latest
```

## 🛡️ Security

- JWT token-based authentication
- Rate limiting to prevent abuse
- Helmet.js for security headers
- Input validation and sanitization
- MongoDB injection prevention
- File upload restrictions
- CORS configuration

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For support or questions, please open an issue on GitHub.

---

Built with ❤️ for the Tender Portal project