# Backend Testing Infrastructure - ALA Medical Application

## Overview

This directory contains comprehensive test suites for the ALA medical application backend, designed to ensure reliability, security, and compliance with medical software standards.

## Test Architecture

### Directory Structure

```
tests/
├── setup.ts                    # Global test setup and configuration
├── fixtures/
│   └── testData.ts             # Mock data for medical workflows
├── helpers/
│   └── mockHelpers.ts          # Reusable mock utilities and helpers
├── services/
│   ├── priorityService.test.ts # Priority API integration tests
│   └── applicatorService.test.ts # Applicator validation tests
├── controllers/
│   ├── authController.test.ts  # Authentication endpoint tests
│   └── treatmentController.test.ts # Treatment workflow tests
├── models/
│   └── User.test.ts           # Database model tests
└── integration/
    └── api.integration.test.ts # End-to-end workflow tests
```

### Testing Technologies

- **Jest**: Primary testing framework
- **Supertest**: HTTP API testing
- **ts-jest**: TypeScript support for Jest
- **SQLite**: In-memory database for testing
- **Mock frameworks**: Comprehensive mocking for external services

## Test Categories

### 1. Unit Tests (`tests/services/`, `tests/models/`)

**Priority Service Tests** (`priorityService.test.ts`)
- ✅ Priority API connection testing
- ✅ User site access validation
- ✅ Order filtering and date handling
- ✅ Removal status checking
- ✅ Error handling and fallbacks
- ✅ Test data vs real API logic

**Applicator Service Tests** (`applicatorService.test.ts`)
- ✅ 5-scenario validation logic
- ✅ Priority API integration
- ✅ Applicator import workflows
- ✅ Data transformation and persistence
- ✅ Medical workflow constraints

**User Model Tests** (`User.test.ts`)
- ✅ Database schema validation
- ✅ Authentication code generation
- ✅ Code verification logic
- ✅ User role assignment
- ✅ Metadata management

### 2. Controller Tests (`tests/controllers/`)

**Authentication Controller** (`authController.test.ts`)
- ✅ Verification code request/verify flow
- ✅ Priority API integration
- ✅ JWT token generation
- ✅ User creation and updates
- ✅ Error handling and security

**Treatment Controller** (`treatmentController.test.ts`)
- ✅ CRUD operations
- ✅ Applicator management
- ✅ Treatment completion workflows
- ✅ Medical data validation
- ✅ User authorization

### 3. Integration Tests (`tests/integration/`)

**API Integration** (`api.integration.test.ts`)
- ✅ Full authentication workflows
- ✅ Treatment creation to completion
- ✅ Medical applicator validation
- ✅ Priority API integration
- ✅ Error handling and recovery
- ✅ Security and performance testing

## Medical Application Testing Features

### Priority API Integration Testing
- Mock Priority API responses
- Test data vs real API switching
- Error handling and fallbacks
- Date filtering and OData queries
- User authentication and site access

### Medical Workflow Validation
- 5-scenario applicator validation
- Treatment type constraints (insertion/removal)
- Seed quantity calculations
- Patient ID verification
- Medical data integrity

### Security Testing
- JWT authentication
- Input sanitization
- SQL injection prevention
- XSS protection
- Access control validation

## Running Tests

### All Tests
```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage report
npm run test:watch         # Run in watch mode
npm run test:verbose       # Run with detailed output
```

### Category-Specific Tests
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:services      # Service layer tests
npm run test:controllers   # Controller tests
npm run test:models        # Database model tests
```

### Medical Domain Tests
```bash
npm run test:priority      # Priority API service tests
npm run test:applicator    # Applicator validation tests
npm run test:auth         # Authentication tests
npm run test:treatment    # Treatment workflow tests
npm run test:user         # User model tests
npm run test:medical      # All medical workflow tests
```

### CI/CD and Debugging
```bash
npm run test:ci           # CI/CD optimized run
npm run test:debug        # Debug mode with verbose output
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support with ts-jest
- In-memory SQLite database
- Mock setup and teardown
- Coverage reporting (HTML, LCOV, text)
- 30-second timeout for medical workflows

### Environment Variables
```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key
DB_HOST=localhost
DB_NAME=medical_app_test
ENABLE_TEST_DATA=true
BYPASS_PRIORITY_EMAILS=test@example.com,test@bypass.com
```

## Mock Data and Fixtures

### Test Data Structure
- **Medical Sites**: Hospital configurations
- **Treatment Orders**: Priority API order format
- **Applicators**: Medical device data
- **Users**: Different role types (hospital, admin, alphatau)
- **Validation Scenarios**: 5-scenario applicator validation

### Priority API Mocking
- Successful API responses
- Error scenarios (timeouts, rate limits)
- Test data vs real API switching
- Authentication and authorization

## Coverage Targets

- **Overall Coverage**: > 80%
- **Critical Paths**: > 95% (authentication, medical workflows)
- **Services**: > 90% (Priority API, applicator validation)
- **Controllers**: > 85% (API endpoints)
- **Models**: > 90% (database operations)

## Medical Compliance Features

### Data Integrity Testing
- Medical record consistency
- Treatment workflow validation
- Audit trail verification
- Patient data protection

### Error Recovery Testing
- Priority API outages
- Database connection failures
- Network timeouts
- Data corruption scenarios

### Security Compliance
- Authentication bypass prevention
- Input validation
- SQL injection protection
- XSS prevention
- Access control enforcement

## Best Practices

### Test Writing Guidelines
1. **Descriptive Test Names**: Clear medical context
2. **Isolation**: Each test is independent
3. **Realistic Data**: Medical-accurate test scenarios
4. **Error Cases**: Test failure scenarios
5. **Performance**: Consider medical workflow timing

### Mock Strategy
1. **External Services**: Always mock Priority API
2. **Database**: Use in-memory SQLite
3. **Time-Sensitive**: Mock date/time functions
4. **Authentication**: Mock JWT verification
5. **File System**: Mock test data loading

### Medical Domain Testing
1. **Validation Logic**: Test all 5 applicator scenarios
2. **Workflow States**: Test treatment progression
3. **Data Relationships**: Test patient-treatment-applicator links
4. **Business Rules**: Test medical constraints
5. **Integration Points**: Test Priority API workflows

## Continuous Integration

### Pre-commit Testing
```bash
npm run lint               # ESLint checks
npm run build             # TypeScript compilation
npm run test:unit         # Fast unit tests
```

### CI Pipeline Testing
```bash
npm run test:ci           # Full test suite with coverage
npm run test:integration  # Integration tests
```

### Coverage Reporting
- HTML reports in `coverage/` directory
- LCOV format for CI integration
- Console output for quick feedback
- Coverage badges for documentation

## Troubleshooting

### Common Issues

**Test Database Connection**
```bash
# Check SQLite memory database
# Tests should use in-memory DB, not PostgreSQL
```

**Priority API Mocking**
```bash
# Ensure mocks are properly reset between tests
# Check mock implementation in helpers/mockHelpers.ts
```

**TypeScript Compilation**
```bash
npm run build             # Check for TypeScript errors
npm run test:debug        # Run tests with debugging
```

**Test Isolation**
```bash
# Each test should clean up after itself
# Check beforeEach/afterEach hooks
```

### Debug Commands
```bash
npm run test:debug        # Verbose output with stack traces
npm run test:verbose      # Detailed test information
npm run test -- --runInBand # Run tests serially
```

## Contributing to Tests

### Adding New Tests
1. Follow existing test structure
2. Use medical-accurate test data
3. Include error scenarios
4. Add integration tests for new workflows
5. Update coverage targets if needed

### Modifying Existing Tests
1. Ensure backward compatibility
2. Update related integration tests
3. Maintain coverage levels
4. Document changes in test descriptions

### Test Data Management
1. Add new fixtures to `fixtures/testData.ts`
2. Update mock helpers as needed
3. Ensure test data reflects real medical workflows
4. Consider Privacy implications in test data

## Medical Testing Standards

This test suite is designed to support medical software development standards including:

- **FDA 21 CFR Part 820**: Quality system regulations
- **IEC 62304**: Medical device software lifecycle
- **ISO 14155**: Clinical investigation of medical devices
- **HIPAA**: Patient data protection (in test scenarios)

The comprehensive testing ensures the application meets reliability and safety standards required for medical device software.