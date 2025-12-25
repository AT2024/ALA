# User Role Permission Matrix

## Overview

The ALA system implements role-based access control (RBAC) with three primary roles and a special administrative override via Position Code 99.

## User Roles

### Hospital Worker
- **Description**: Clinical staff at healthcare facilities performing treatments
- **Typical Users**: Nurses, radiotherapy technicians, physicians
- **Site Access**: Limited to assigned sites from Priority ERP

### AlphaTau Employee
- **Description**: Alpha Tau Medical clinical operations personnel
- **Typical Users**: Clinical support specialists, field engineers
- **Site Access**: All sites (company-wide access)

### Administrator
- **Description**: System administrators and IT personnel
- **Typical Users**: IT staff, system managers
- **Site Access**: All sites with full configuration access

### Position Code 99 (Override)
- **Description**: Special Priority ERP designation granting full administrative access
- **Effect**: Overrides any role assignment with full admin permissions
- **Typical Users**: Executive accounts, emergency access accounts

## Permission Matrix

### Authentication & Session

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| Login via email | Yes | Yes | Yes | |
| Receive verification codes | Yes | Yes | Yes | |
| Session auto-renewal | Yes | Yes | Yes | 7-day JWT expiration |
| Logout | Yes | Yes | Yes | |

### Treatment Operations

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| View treatments (own sites) | Yes | Yes | Yes | |
| View treatments (all sites) | No | Yes | Yes | |
| Create insertion treatment | Yes | Yes | Yes | Site-restricted for Hospital |
| Create removal treatment | Yes | Yes | Yes | Site-restricted for Hospital |
| Edit treatment details | Yes | Yes | Yes | Before finalization only |
| Delete treatment | No | No | Yes | Only incomplete treatments |

### Applicator Operations

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| Scan applicators | Yes | Yes | Yes | |
| Manual serial entry | Yes | Yes | Yes | |
| Add applicator to treatment | Yes | Yes | Yes | |
| Edit applicator details | Yes | Yes | Yes | Before treatment finalization |
| Change applicator status | Yes | Yes | Yes | Within workflow rules |
| Override seed quantity | Yes | Yes | Yes | Requires justification |

### Finalization Operations

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| Initiate finalization | Yes | Yes | Yes | |
| Auto-sign (hospital signature) | Yes | No | Yes | |
| Request verified signature | N/A | Yes | Yes | Sends code to signer |
| Sign with verification | N/A | Yes | Yes | Signer must be from site |
| Generate PDF | Yes | Yes | Yes | After finalization |
| Export treatment data | Yes | Yes | Yes | JSON format |

### Administrative Operations

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| View admin dashboard | No | No | Yes | |
| View system logs | No | No | Yes | |
| View audit logs | No | Partial | Yes | AlphaTau can view treatment-related |
| View user list | No | No | Yes | |
| System configuration | No | No | Yes | |

### Data Access

| Permission | Hospital | AlphaTau | Admin | Notes |
|------------|:--------:|:--------:|:-----:|-------|
| View patient identifiers | Yes | Yes | Yes | Subject ID only, no PHI |
| View Priority patient data | Yes | Yes | Yes | Via DETAILS field |
| View applicator serial numbers | Yes | Yes | Yes | |
| View seed quantities | Yes | Yes | Yes | |
| View audit trail | No | Partial | Yes | |

## Site Access Rules

### Standard Site Restriction (Hospital Role)

```
User's Authorized Sites = Priority PHONEBOOK.SITES for user's email
Allowed Actions = Only on treatments where Treatment.site IN User's Authorized Sites
```

### Full Site Access (AlphaTau Role)

```
User's Authorized Sites = ALL SITES
Allowed Actions = All treatments regardless of site
```

### Position Code 99 Override

```
IF User.metadata.positionCode == 99 THEN
    User's Authorized Sites = ALL SITES
    User's Permissions = ADMIN level
ENDIF
```

## Role Determination Logic

```typescript
function determineEffectiveRole(user: User): EffectiveRole {
    // Position Code 99 overrides everything
    if (user.metadata?.positionCode === 99) {
        return {
            role: 'admin',
            sites: 'ALL',
            fullAccess: true
        };
    }

    // Otherwise use assigned role
    return {
        role: user.role,
        sites: user.role === 'hospital'
            ? user.metadata?.sites || []
            : 'ALL',
        fullAccess: user.role !== 'hospital'
    };
}
```

## Test User Configuration

For development and testing purposes:

| Email | Role | Position | Access |
|-------|------|----------|--------|
| test@example.com | hospital | - | Test data only |
| alexs@alphatau.com | admin | 99 | Full admin (Position 99) |

**Important**: Test users only receive test data, never production data. This isolation is enforced at the data loading level.

## Implementation References

- Role assignment: `backend/src/models/User.ts`
- Authorization middleware: `backend/src/middleware/authMiddleware.ts`
- Site filtering: `backend/src/services/priorityService.ts`
- Frontend auth context: `frontend/src/context/AuthContext.tsx`
