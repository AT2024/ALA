# API Reference

## Base URLs

### Local Development
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **WebSocket**: ws://localhost:5000

### Production (Azure)
- **Frontend**: http://20.217.84.100:3000 (HTTPS: https://20.217.84.100:3000)
- **Backend API**: http://20.217.84.100:5000 (HTTPS: https://20.217.84.100:5000)
- **WebSocket**: ws://20.217.84.100:5000 (WSS: wss://20.217.84.100:5000)

## Authentication Endpoints

### Request Authentication Code
```http
POST /api/auth/request-code
Content-Type: application/json

{
  "identifier": "email@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code sent to email@example.com"
}
```

**Notes:**
- Code expires in 5 minutes
- Code is 6 digits
- Sent via email for production users
- Fixed code `123456` for `test@example.com`

### Verify Authentication Code
```http
POST /api/auth/verify
Content-Type: application/json

{
  "identifier": "email@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "email": "email@example.com",
    "name": "User Name",
    "positionCode": "99",
    "sites": ["Site1", "Site2"]
  }
}
```

**Notes:**
- Returns JWT token valid for 24 hours
- Token must be included in Authorization header for protected endpoints
- Position Code 99 = Full admin access to all sites

### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer <current-token>
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Health & Status Endpoints

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T12:00:00Z",
  "services": {
    "database": "connected",
    "priority": "connected",
    "cache": "connected"
  },
  "version": "1.0.0"
}
```

### System Status
```http
GET /api/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "activeSessions": 5,
  "activeTreatments": 2,
  "queuedJobs": 0,
  "systemLoad": {
    "cpu": 45,
    "memory": 62,
    "disk": 38
  }
}
```

## Treatment Endpoints

### Get Available Treatments
```http
GET /api/treatments
Authorization: Bearer <token>
```

**Response:**
```json
{
  "treatments": [
    {
      "id": "TR001",
      "patientName": "John Doe",
      "patientId": "P12345",
      "treatmentType": "insertion",
      "scheduledDate": "2025-09-30",
      "site": "Site Name",
      "applicatorsRequired": 15,
      "seedsPerApplicator": 10
    }
  ]
}
```

### Get Treatment Details
```http
GET /api/treatments/:treatmentId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "TR001",
  "patient": {
    "name": "John Doe",
    "id": "P12345",
    "dateOfBirth": "1960-01-01"
  },
  "treatment": {
    "type": "insertion",
    "scheduledDate": "2025-09-30",
    "site": "Site Name",
    "physician": "Dr. Smith"
  },
  "applicators": {
    "required": 15,
    "scanned": 8,
    "remaining": 7
  },
  "seeds": {
    "total": 150,
    "used": 80,
    "faulty": 5,
    "noUse": 10
  }
}
```

### Start Treatment Session
```http
POST /api/treatments/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "treatmentId": "TR001",
  "treatmentType": "insertion"
}
```

**Response:**
```json
{
  "sessionId": "SES123456",
  "treatmentId": "TR001",
  "startTime": "2025-09-30T14:00:00Z",
  "status": "active"
}
```

### End Treatment Session
```http
POST /api/treatments/end
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "SES123456",
  "summary": {
    "applicatorsUsed": 15,
    "seedsUsed": 140,
    "faultySeeds": 10,
    "duration": 3600
  }
}
```

## Applicator Endpoints

### Validate Applicator
```http
POST /api/applicators/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "serialNumber": "APP123456",
  "treatmentId": "TR001",
  "treatmentType": "insertion"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "applicator": {
    "serialNumber": "APP123456",
    "name": "Applicator Name",
    "seedCount": 10,
    "expiryDate": "2025-12-31"
  }
}
```

**Response (Validation Failed):**
```json
{
  "valid": false,
  "reason": "already_scanned",
  "message": "This applicator has already been scanned in this treatment"
}
```

**Validation Failure Reasons:**
- `already_scanned` - Already used in current treatment
- `wrong_treatment` - Not for insertion/removal type
- `no_use` - Marked as no use in Priority
- `not_allowed` - Not in site's allowed list
- `expired` - Past expiry date

### Scan Applicator
```http
POST /api/applicators/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "SES123456",
  "serialNumber": "APP123456",
  "useType": "full_use"
}
```

**Use Types:**
- `full_use` - All seeds used
- `faulty` - Seeds were faulty
- `no_use` - Applicator not used

**Response:**
```json
{
  "success": true,
  "treatment": {
    "progress": {
      "applicatorsScanned": 9,
      "applicatorsRemaining": 6,
      "seedsUsed": 90,
      "percentage": 60
    }
  }
}
```

### Get Recent Applicators
```http
GET /api/applicators/recent?hours=24
Authorization: Bearer <token>
```

**Response:**
```json
{
  "applicators": [
    {
      "serialNumber": "APP123456",
      "usedAt": "2025-09-29T10:00:00Z",
      "treatment": "TR000",
      "patient": "Jane Doe"
    }
  ]
}
```

## Site Management Endpoints

### Get Available Sites
```http
GET /api/sites
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sites": [
    {
      "code": "SITE001",
      "name": "Main Hospital",
      "address": "123 Medical St",
      "authorized": true
    }
  ]
}
```

**Notes:**
- Position Code 99 users get all 100+ sites
- Other users get sites based on Priority PHONEBOOK authorization

## Priority Integration Endpoints

### Sync with Priority
```http
POST /api/priority/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "syncType": "orders",
  "date": "2025-09-30"
}
```

**Sync Types:**
- `orders` - Patient orders
- `applicators` - Applicator list
- `sites` - Customer/site list
- `all` - Full sync

**Response:**
```json
{
  "success": true,
  "synced": {
    "orders": 25,
    "applicators": 150,
    "sites": 0
  },
  "duration": 1250
}
```

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:5000');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'Bearer token'
}));
```

### Event Types

#### Treatment Updates
```json
{
  "type": "treatment_update",
  "data": {
    "sessionId": "SES123456",
    "progress": {
      "applicatorsScanned": 10,
      "percentage": 66
    }
  }
}
```

#### Validation Results
```json
{
  "type": "validation_result",
  "data": {
    "serialNumber": "APP123456",
    "valid": true,
    "details": {}
  }
}
```

## Test Users

| Email | Code | Access Level | Purpose |
|-------|------|--------------|---------|
| `test@example.com` | `123456` | Limited | Development testing |
| `test@bypass.com` | Any code | Limited | Emergency bypass |
| `alexs@alphatau.com` | Via email | Position 99 (Full Admin) | Production admin with all sites |

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Authentication token is invalid or expired",
    "details": {}
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_TOKEN` | 401 | Token invalid or expired |
| `UNAUTHORIZED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `PRIORITY_ERROR` | 502 | Priority API error |
| `SERVER_ERROR` | 500 | Internal server error |

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **API endpoints**: 100 requests per minute per token
- **WebSocket connections**: 1 per token
- **Priority sync**: 10 requests per hour

## Request Headers

### Required Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Optional Headers
```http
X-Request-ID: unique-request-id
X-Client-Version: 1.0.0
Accept-Language: en-US
```

## Response Headers

### Standard Response Headers
```http
X-Request-ID: unique-request-id
X-Response-Time: 125ms
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1696089600
```

## Pagination

### Query Parameters
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field (e.g., `date`, `-date` for descending)
- `filter` - Filter expression

### Paginated Response
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## API Versioning

The API uses URL versioning. Current version: v1

Future versions will be available at:
- `/api/v2/...`
- `/api/v3/...`

The unversioned `/api/...` endpoints will always point to v1 for backward compatibility.

## CORS Configuration

### Allowed Origins (Production)
- https://20.217.84.100:3000
- http://20.217.84.100:3000

### Allowed Methods
- GET, POST, PUT, DELETE, OPTIONS

### Allowed Headers
- Authorization, Content-Type, X-Request-ID, X-Client-Version

## Security Notes

1. All production endpoints should use HTTPS
2. JWT tokens expire after 24 hours
3. Sensitive operations require Position Code 99
4. All inputs are validated and sanitized
5. SQL injection prevention via parameterized queries
6. XSS protection via content sanitization
7. CSRF protection via token validation