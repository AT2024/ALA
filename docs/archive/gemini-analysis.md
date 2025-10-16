# Using Gemini CLI for ALA Medical Application Analysis

When analyzing the ALA medical treatment tracking application or working with large codebases that might exceed context limits, use the Gemini CLI with its massive context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

## File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the gemini command from the project root:

### ALA Project Structure Examples:

**Backend analysis:**
```bash
gemini -p "@backend/src/ Analyze the Priority API integration implementation"
gemini -p "@backend/src/controllers/ @backend/src/services/ Review the applicator validation logic"
gemini -p "@backend/src/models/ Explain the data model relationships for Treatment, Applicator, and User"
```

**Frontend analysis:**
```bash
gemini -p "@frontend/src/ Analyze the React component structure and state management"
gemini -p "@frontend/src/context/ Review the TreatmentContext and AuthContext implementations"
gemini -p "@frontend/src/pages/Treatment/ Examine the treatment workflow UI components"
```

**Full application analysis:**
```bash
gemini -p "@backend/src/ @frontend/src/ Analyze the complete application architecture"
gemini -p "@./ Give me an overview of the entire ALA medical tracking project"
gemini --all_files -p "Analyze the project structure and medical domain implementation"
```

**Docker and deployment:**
```bash
gemini -p "@docker-compose.yml @backend/Dockerfile @frontend/Dockerfile Review the containerization setup"
gemini -p "@environments/ @azure/ Analyze the deployment configuration"
```

## Medical Domain-Specific Analysis Examples

### Priority API Integration Verification
```bash
gemini -p "@backend/src/services/priorityService.ts @backend/src/controllers/priorityController.ts Is the Priority API integration properly implemented for patient data retrieval?"

gemini -p "@backend/src/ Does the application properly handle Priority API authentication and site access restrictions?"
```

### Treatment Workflow Analysis
```bash
gemini -p "@frontend/src/pages/Treatment/ @frontend/src/context/TreatmentContext.tsx Is the treatment workflow (insertion/removal) correctly implemented with progress tracking?"

gemini -p "@backend/src/services/treatmentService.ts @frontend/src/services/treatmentService.ts Analyze the treatment data flow from frontend to backend"
```

### Applicator Validation System
```bash
gemini -p "@backend/src/services/applicatorService.ts @frontend/src/services/applicatorService.ts Review the 5-scenario applicator validation system implementation"

gemini -p "@backend/src/controllers/applicatorController.ts Is the applicator barcode scanning and validation working correctly?"
```

### Authentication and Security
```bash
gemini -p "@backend/src/middleware/authMiddleware.ts @backend/src/controllers/authController.ts Is JWT authentication properly implemented for medical data access?"

gemini -p "@backend/src/ @frontend/src/context/AuthContext.tsx Verify the verification code-based login system implementation"

gemini -p "@backend/src/ @frontend/src/ Are there proper security measures for handling medical data and Priority API credentials?"
```

## Implementation Verification Examples

### QR Code Scanner Integration
```bash
gemini -p "@frontend/src/components/ @frontend/src/pages/Treatment/ Is the Html5QrcodeScanner properly integrated for applicator identification?"
```

### Progress Tracking System
```bash
gemini -p "@frontend/src/context/TreatmentContext.tsx @frontend/src/components/ProgressTracker.tsx Is the real-time progress calculation working correctly for seed usage and completion?"
```

### Database and Data Persistence
```bash
gemini -p "@backend/src/models/ @backend/src/config/database.ts Is the PostgreSQL integration properly configured with proper migrations?"

gemini -p "@backend/src/ Is dual storage (local PostgreSQL + Priority system sync) implemented correctly?"
```

### Error Handling and Validation
```bash
gemini -p "@backend/src/middleware/ @frontend/src/services/ Are comprehensive validation and error handling implemented at all layers?"

gemini -p "@backend/src/ @frontend/src/ Is there graceful degradation for offline scenarios and Priority API failures?"
```

### Docker and Environment Configuration
```bash
gemini -p "@docker-compose.yml @docker-compose.prod.yml @environments/ Is the Docker configuration properly set up for development and production?"

gemini -p "@backend/Dockerfile @frontend/Dockerfile Are the containers properly secured with non-root execution?"
```

## Architecture Analysis Examples

### Service Layer Architecture
```bash
gemini -p "@backend/src/services/ @backend/src/controllers/ Analyze the service layer architecture and controller interactions"

gemini -p "@backend/src/routes/ @backend/src/middleware/ Review the API routing and middleware implementation"
```

### React Context and State Management
```bash
gemini -p "@frontend/src/context/ @frontend/src/components/ Analyze the React context usage and component state management"

gemini -p "@frontend/src/hooks/ @frontend/src/services/ Review the custom hooks and service layer integration"
```

### Integration Points Analysis
```bash
gemini -p "@backend/src/services/priorityService.ts @frontend/src/services/priorityService.ts Analyze the Priority API integration across frontend and backend"

gemini -p "@backend/src/ @frontend/src/ Review all external integration points (Priority API, barcode scanner, database)"
```

## Security Auditing Examples

### Medical Data Security
```bash
gemini -p "@backend/src/ @frontend/src/ Audit the application for proper handling of sensitive medical data"

gemini -p "@backend/src/middleware/ @backend/src/controllers/ Check for input validation and sanitization in all endpoints"
```

### Authentication Security
```bash
gemini -p "@backend/src/middleware/authMiddleware.ts @backend/src/controllers/authController.ts Verify JWT token handling and session management security"

gemini -p "@backend/src/ Are there proper rate limiting and brute force protection measures?"
```

### Container Security
```bash
gemini -p "@backend/Dockerfile @frontend/Dockerfile @docker-compose.yml Audit the container security configuration"

gemini -p "@scripts/security-scan.js @.github/workflows/ Review the automated security scanning implementation"
```

## Performance Analysis Examples

### Database Performance
```bash
gemini -p "@backend/src/models/ @backend/src/services/ Analyze database query performance and potential optimizations"

gemini -p "@backend/src/config/database.ts Are database connections properly pooled and managed?"
```

### Frontend Performance
```bash
gemini -p "@frontend/src/ Identify potential performance bottlenecks in React components and context usage"

gemini -p "@frontend/src/context/ Is the TreatmentContext optimized to avoid unnecessary re-renders?"
```

## When to Use Gemini CLI for ALA Project

Use `gemini -p` when:
- **Analyzing entire medical workflow**: Understanding treatment processes across multiple files
- **Priority API integration review**: Checking complex integration patterns across services
- **Security auditing**: Comprehensive security analysis of medical data handling
- **Architecture verification**: Understanding service interactions and data flow
- **Performance assessment**: Identifying bottlenecks in treatment processing
- **Implementation status checks**: Verifying feature completeness against requirements
- **Cross-component analysis**: Understanding React context usage and state management
- **Docker configuration review**: Analyzing containerization and deployment setup
- **Error handling verification**: Ensuring robust error handling across the application
- **Database schema analysis**: Understanding data model relationships and migrations

## Important Notes for ALA Project

- **Medical compliance**: When analyzing, consider HIPAA and medical data regulations
- **Priority API sensitivity**: Be aware of external API dependencies and rate limiting
- **Real-time requirements**: Consider the real-time validation needs for applicator scanning
- **Mobile responsiveness**: Ensure analysis covers mobile-first design requirements
- **Security priority**: Always prioritize security analysis for medical applications
- **Integration complexity**: Focus on the complex Priority API integration patterns
- **State management**: Pay attention to React context usage for treatment state
- **Error recovery**: Analyze offline scenarios and graceful degradation

### Project-Specific Directories to Focus On:
- `@backend/src/services/` - Core business logic and Priority API integration
- `@frontend/src/context/` - React state management for treatment workflow
- `@frontend/src/pages/Treatment/` - Treatment workflow UI components
- `@backend/src/controllers/` - API endpoints and request handling
- `@backend/src/models/` - Data models for Treatment, Applicator, User
- `@environments/` - Configuration files for different environments
- `@scripts/` - Build, debug, and security scanning scripts