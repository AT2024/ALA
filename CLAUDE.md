# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### **When to Use Gemini CLI Analysis**

Use Gemini CLI commands from `gemini-analysis.md` when Claude Code needs to:

- **Analyze Large Codebases**: When examining entire directories or multiple large files
- **Implementation Status Checks**: Verify Phase completion status against CLAUDE.md roadmap
- **Architecture Verification**: Understand service interactions and integration points
- **Cross-Service Analysis**: Check dependencies between services, routers, and core components
- **Performance Assessment**: Identify blocking operations and optimization opportunities
- **Security Auditing**: Verify safety measures and error handling across the system
- **Integration Testing**: Validate end-to-end workflows and API compatibility

### **When to Use MCP Servers**

Use MCP (Model Context Protocol) servers for specialized tasks. Available globally at `~/mcp-servers-global/`:

- **Context7 MCP**: Official library documentation and design patterns
  - Use for: API documentation research, framework best practices, coding patterns
  - Example: "How to implement JWT authentication in Express" or "React Context patterns"
  
- **Sequential MCP**: Complex multi-step thinking and problem-solving
  - Use for: Breaking down complex features, architectural decisions, debugging workflows
  - Example: Planning multi-phase implementations, troubleshooting complex bugs
  
- **Magic MCP**: Modern UI component generation
  - Use for: Creating React components, Tailwind styling, responsive design
  - Example: "Generate a medical data table component" or "Create a progress tracker UI"
  
- **Playwright MCP**: Browser automation and testing
  - Use for: E2E testing, UI testing, browser automation scripts
  - Example: Testing treatment workflows, validating barcode scanner functionality

**MCP Server Management:**
```bash
# Start MCP servers globally
cd ~/mcp-servers-global && docker-compose up -d

# Stop MCP servers  
cd ~/mcp-servers-global && docker-compose down

# Check MCP status
docker ps --filter "name=mcp"
```

## Development Commands

### Running the Application
```bash
# Interactive application runner (recommended)
npm run dev                               # Starts interactive menu
node run.js                               # Alternative way to start runner

# Direct Docker commands
docker-compose up -d                      # Development with hot reload
docker-compose up -d --build            # Development with rebuild
docker-compose down                       # Stop all containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Production

# Debug and diagnostics
node scripts/debug-unified.js            # Interactive debug tool
node scripts/debug-unified.js health     # Quick health check
node scripts/debug-unified.js start      # Start development
```

### Backend Development
```bash
cd backend
npm run dev                               # Development with nodemon
npm run build                             # TypeScript compilation
npm run lint                              # ESLint with auto-fix
npm run test                              # Jest tests
npm run db:init                           # Initialize database
```

### Frontend Development
```bash
cd frontend
npm run dev                               # Vite development server
npm run build                             # Production build
npm run lint                              # ESLint check
npm run format                            # Prettier formatting
npm run test                              # Vitest tests
npm run test:e2e                          # Playwright E2E tests
```

## Architecture Overview

### Application Structure
This is a **medical treatment tracking application** with two main components:

**Backend (Node.js/Express/TypeScript)**
- **Priority System Integration**: Core feature that connects to external Priority API for patient/treatment data
- **Authentication**: Verification code-based login (SMS/email) with JWT tokens
- **Data Models**: Treatment, Applicator, and User entities with PostgreSQL storage
- **Controllers**: Handle Priority API proxying, applicator validation, and treatment management
- **Services**: Business logic for treatment workflow, applicator validation, and Priority data synchronization

**Frontend (React/TypeScript/Tailwind)**
- **Treatment Context**: Global state management for current treatment and applicator data
- **Progress Tracking**: Real-time calculation of treatment completion, seed usage, and applicator progress
- **QR Code Scanner**: Html5QrcodeScanner integration for applicator barcode scanning
- **Responsive UI**: Tailwind-based design with mobile-first approach

### Key Business Logic

**Treatment Workflow**:
1. User selects treatment type (insertion/removal) and patient
2. System validates against Priority API for authorized sites and patients
3. User scans/enters applicator serial numbers with real-time validation
4. System tracks seed usage with three types: Full use, Faulty, No use
5. Progress tracking shows completion percentage and remaining applicators/seeds

**Applicator Validation**:
- 5-scenario validation system (already scanned, wrong treatment, no use, not allowed, valid)
- Day-before/day-after validation for manual entry
- Fuzzy matching for similar applicator names
- Priority API integration for real-time validation

**Priority Integration**:
- Position code '99' grants access to all sites, others are site-restricted
- Real-time querying of PHONEBOOK, ORDERS, and PARTS tables
- Automatic import of applicator data from recent treatments (24-hour window)

### Data Flow
1. **Authentication**: User verification through Priority PHONEBOOK API
2. **Treatment Selection**: Patient data auto-populated from Priority ORDERS
3. **Applicator Processing**: Real-time validation against Priority SIBD_APPLICATUSELIST
4. **Progress Tracking**: Live calculations in TreatmentContext with completion metrics
5. **Data Persistence**: Dual storage (local PostgreSQL + Priority system sync)

### State Management
- **React Context**: TreatmentContext manages treatment state and progress calculations
- **Authentication Context**: User session and site permissions
- **Local Storage**: Offline support and caching for Priority data

### Docker Configuration
- **Development**: Hot reload with volume mounts for both frontend and backend
- **Production**: Multi-stage builds with security hardening
- **Database**: PostgreSQL with health checks and persistent volumes
- **Environment**: Separate configurations for dev/prod with Priority API endpoints

### Key Integration Points
- **Priority API**: External medical system for patient/treatment data
- **Barcode Scanner**: Html5QrcodeScanner for applicator identification
- **Real-time Validation**: Immediate feedback during applicator entry
- **Progress Tracking**: Live updates as applicators are processed

### Error Handling
- Comprehensive validation at multiple layers (frontend, backend, Priority API)
- Graceful degradation for offline scenarios
- User-friendly error messages with actionable guidance
- Fallback mechanisms for Priority API failures

### Security Features
- Non-root container execution (UID/GID: 1001)
- JWT-based authentication with verification codes
- Input validation and sanitization
- Health checks and monitoring
- Automated security scanning with Trivy

The application is designed for medical environments requiring reliability, real-time data validation, and seamless integration with existing Priority systems.

## Priority Database & API Development Rules

### Reference Chain Validation Rules
- Always validate reference chains before displaying patient lists to users
- Filter out orders with seedQty = 0 that have reference values pointing to other orders
- Only show root orders (no reference OR seedQty > 0) as valid patients in treatment selection
- Detect and handle circular references in order chains to prevent infinite loops
- Log reference chain traversal process with clear indicators when debugging patient data

### Priority API Query Optimization Rules
- Always include date filtering in Priority API OData queries, never filter dates in backend memory
- Use SIBD_TREATDAY as primary date field for treatment scheduling queries
- Format OData date filters as: `SIBD_TREATDAY ge datetime'YYYY-MM-DDTHH:MM:SS'`
- Pass date parameters from controller to service layer to enable API-level filtering
- Log data source clearly with emoji indicators (🧪 test data, 🎯 real API, ❌ fallback)

### Data Source Management Rules
- Use test data only in development mode with test@example.com user identification
- Apply same filtering logic to both test data and real Priority API responses
- Implement graceful fallback from Priority API to test data when API fails
- Never mix test data with real Priority data without clear logging distinction

### Performance & Debugging Rules
- Avoid retrieving all historical orders for a site when only current date is needed
- Run TypeScript compilation check after modifying backend Priority service files
- Check for duplicate orders by ORDNAME before processing reference chains
- Log Priority API filter parameters and response counts for debugging efficiency issues

### Common Pitfall Prevention Rules
- Validate that order counts make business sense before trusting frontend display logic
- Check reference chain integrity when orders appear to be "made up" by the system
- Verify data source (test vs real) when investigating unexpected order data
- Always log the complete OData query being sent to Priority API for troubleshooting
