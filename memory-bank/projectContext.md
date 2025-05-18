---
project_name: "Accountability Log Application (ALA)"
version: "0.1.0"
last_updated: "2025-05-18T16:30:00Z"
author: "AlphaTau Development Team"
---
# Overview
The Accountability Log Application (ALA) is a comprehensive system for tracking medical treatments, applicator usage, and seed management with a focus on reliability and user experience.

# Technical Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript + Sequelize ORM
- **Database:** PostgreSQL
- **DevOps:** Docker, Docker Compose, Azure deployment
- **Authentication:** JWT with verification code system

# Dependencies
| Dependency        | Version   | Purpose                              |
|-------------------|-----------|--------------------------------------|
| express           | ^4.18.2   | Backend HTTP server                  |
| sequelize         | ^6.32.0   | ORM for database interactions        |
| react             | ^18.2.0   | Frontend UI library                  |
| typescript        | ^5.1.3    | Type safety for JavaScript           |
| tailwindcss       | ^3.4.1    | Utility-first CSS framework          |
| jwt               | ^9.0.0    | Authentication tokens                |
| axios             | ^1.7.2    | HTTP client for API requests         |
| vite              | ^5.2.3    | Frontend build tool and dev server   |
| winston           | ^3.9.0    | Logging for backend                  |

# Architecture
## System Components
- **Backend API:** RESTful services for data operations
- **Frontend SPA:** React-based user interface
- **Priority Integration:** Connection to Priority business system
- **Database:** PostgreSQL for data persistence
- **Authentication:** Verification code-based login

## Key Features
- Secure authentication with verification codes
- Treatment management and tracking
- Barcode scanning for applicators
- Offline support and data synchronization
- Reporting in various formats (CSV, PDF)
- Admin dashboard for system monitoring
- Integration with the Priority system

## Deployment
- Development: Docker Compose with hot-reloading
- Production: Docker containers in Azure
- CI/CD: GitHub Actions workflows
