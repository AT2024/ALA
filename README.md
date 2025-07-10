# Accountability Log Application (ALA)

A comprehensive application for tracking medical treatments, applicator usage, and seed management with a focus on reliability and user experience.

## 📁 Project Structure

```
ala-improved/
├── .env.docker
├── .gitignore
├── azure/
│   ├── azure-deploy.sh
│   ├── deploy.ps1
│   └── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── controllers/
│   │   │   └── authController.ts
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts
│   │   │   ├── errorMiddleware.ts
│   │   │   └── notFoundMiddleware.ts
│   │   ├── models/
│   │   │   ├── Applicator.ts
│   │   │   ├── index.ts
│   │   │   ├── Treatment.ts
│   │   │   └── User.ts
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts
│   │   │   ├── applicatorRoutes.ts
│   │   │   ├── authRoutes.ts
│   │   │   └── treatmentRoutes.ts
│   │   ├── utils/
│   │   │   └── logger.ts
│   │   ├── seedUser.js
│   │   ├── seedUser.ts
│   │   └── server.ts
│   └── tsconfig.json
├── debug.bat
├── debug.sh
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docker-compose.yml
├── docs/
│   └── IMPROVEMENTS.md
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── postcss.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── TreatmentContext.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── Admin/
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── Auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── VerificationPage.tsx
│   │   │   ├── Treatment/
│   │   │   │   ├── ApplicatorInformation.tsx
│   │   │   │   ├── ScanQRCode.tsx
│   │   │   │   ├── SeedRemoval.tsx
│   │   │   │   ├── TreatmentSelection.tsx
│   │   │   │   └── UseList.tsx
│   │   │   └── ProjectDocPage.tsx
│   │   └── services/
│   │       ├── api.ts
│   │       ├── authService.ts
│   │       ├── priorityService.ts
│   │       └── treatmentService.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── README.md
├── restart.bat
└── scripts/
    └── debug.js
```

## 🚀 Features

- **Secure Authentication**: Verification code-based login via SMS/email
- **Treatment Management**: Track and document medical treatments
- **Barcode Scanning**: Scan applicator barcodes with validation
- **Offline Support**: Continue working without network connectivity
- **Reporting**: Generate treatment reports in CSV/PDF formats
- **Admin Dashboard**: Monitor system usage and manage configurations
- **Priority Integration**: Seamless connection to the Priority system

## 🔒 Security

### Security Features
- **Secure Base Images**: Using latest LTS Node.js and security-hardened Alpine/Debian images
- **Non-Root Execution**: All containers run with non-privileged users (UID/GID: 1001)
- **Vulnerability Scanning**: Automated security scanning with Trivy
- **Security Updates**: Automatic security patches applied during builds
- **Health Checks**: Comprehensive health monitoring for all services

### Security Scanning
Run security scans on Docker images:

```bash
# Windows
scripts\security-scan.bat

# Linux/Mac
scripts/security-scan.sh

# Manual scan with Trivy
trivy image ala-frontend-prod
trivy image ala-api-prod
```

### Security Versions
- **Node.js**: `20.19.2-bookworm-slim` (Latest LTS with security patches)
- **Nginx**: `1.25.3-alpine3.18` (Security-hardened Alpine)
- **PostgreSQL**: `16.6-alpine` (Latest stable with security updates)

### CI/CD Security
- Automated vulnerability scanning on every PR
- Security results uploaded to GitHub Security tab
- Weekly scheduled security audits
- Notifications for critical vulnerabilities

For detailed security guidelines, see [`docs/SECURITY.md`](docs/SECURITY.md).

## 🛠️ Technology Stack

### Backend
- Node.js with Express
- TypeScript
- Sequelize ORM
- PostgreSQL
- JWT authentication
- Winston for logging

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Vite
- Context API for state management
- React Router for navigation

### DevOps
- Docker & Docker Compose
- Azure Container Registry
- Azure App Service
- Azure Database for PostgreSQL

## 🏃‍♂️ Getting Started

### Development Mode

```bash
# Clone the repository
git clone https://github.com/AT2024/ALA.git
cd ALA

# Start the development environment
docker-compose -f docker-compose.dev.yml up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Documentation: http://localhost:3000/docs
```

### Production Mode

```bash
# Start the production environment
docker-compose -f docker-compose.prod.yml up -d
```

### Debugging

```bash
# Run the debug script
./debug.bat  # Windows
./debug.sh   # Linux/Mac

# Restart containers
./restart.bat
```

## 📝 Recent Updates

- Fixed API path inconsistencies in authentication service
- Enhanced Priority system integration
- Added comprehensive debugging tools
- Improved error handling and TypeScript type safety
- Added project documentation with visual file explorer

## 🌟 Integration with Priority

The application integrates with the Priority system using the following endpoints:
- `/PHONEBOOK` - For contact information
- `/ORDERS` - For treatment data

Position code '99' grants access to all treatment sites, while other codes restrict users to their assigned sites.

## 🧪 Debugging Tools

The application includes several debugging utilities:
- `debug.bat`/`debug.sh` - Test connectivity to backend and Priority APIs
- `scripts/debug.js` - Detailed diagnostic script
- `restart.bat` - Restart Docker containers
- Project documentation page at `/docs`

## 📚 Documentation

Access the built-in documentation by navigating to `/docs` in the running application. The documentation includes:
- File structure visualization
- Recent changes
- Running instructions
- Debugging tips

## 📄 License

Proprietary - All rights reserved
