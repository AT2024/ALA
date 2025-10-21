# ADR-001: Use PostgreSQL for Treatment Data Storage

**Status**: Accepted
**Date**: 2024-09-01 (retroactive documentation)
**Deciders**: Development Team

## Context

The ALA Medical Treatment Tracking System needs a reliable database to store:
- Treatment records and progress tracking
- Applicator validation history
- User authentication and authorization data
- Audit logs for medical compliance
- Synchronized data from Priority ERP

Key requirements:
- ACID compliance for medical data integrity
- Support for complex queries and joins
- Reliable transaction handling
- JSON support for flexible data structures
- Open-source with strong community support
- Good Node.js/TypeScript integration

## Decision

We chose **PostgreSQL** as the primary database for the ALA system.

## Rationale

### Why PostgreSQL

1. **ACID Compliance**: Full ACID guarantees ensure medical data integrity - critical for patient safety
2. **Robust Transactions**: Complex multi-step operations (treatment + audit log) need reliable transactions
3. **JSON Support**: Native JSONB type allows flexible storage of Priority API responses and evolving data structures
4. **TypeScript Integration**: Excellent Sequelize ORM support with TypeScript type safety
5. **Open Source**: No licensing costs, strong community, extensive documentation
6. **Proven Reliability**: Battle-tested in production medical applications
7. **Advanced Features**: Triggers, stored procedures, constraints for data integrity
8. **Performance**: Efficient indexing and query optimization for medical record lookups

### Key Features Used

- **Transactions**: For atomic treatment updates
- **Foreign Keys**: To maintain referential integrity between treatments, applicators, users
- **Indexes**: On frequently queried fields (treatment status, dates, user IDs)
- **Triggers**: For automatic audit log creation
- **Constraints**: To enforce business rules at database level
- **JSONB**: For storing flexible Priority API response data

## Consequences

### Positive

✅ **Data Integrity**: ACID compliance ensures no data loss or corruption
✅ **Transaction Support**: Complex medical workflows can be atomic
✅ **Type Safety**: Sequelize + TypeScript provides compile-time safety
✅ **Scalability**: Can handle growing treatment data volume
✅ **Reliability**: Proven in production medical systems
✅ **Flexibility**: JSON support allows schema evolution
✅ **Cost**: Open-source, no licensing fees
✅ **Community**: Large ecosystem, extensive documentation

### Negative

⚠️ **Learning Curve**: Team needs PostgreSQL-specific knowledge
⚠️ **Infrastructure**: Requires PostgreSQL server management
⚠️ **Migration Complexity**: Schema changes require careful migration planning
⚠️ **Backup Strategy**: Must implement proper backup/restore procedures

### Neutral

ℹ️ **ORM Choice**: Sequelize chosen for TypeScript integration
ℹ️ **Hosting**: PostgreSQL available on Azure, compatible with deployment strategy
ℹ️ **Development**: Local Docker Compose includes PostgreSQL container

## Alternatives Considered

### Option 1: MySQL/MariaDB
- **Pros**:
  - Similar features to PostgreSQL
  - Wide adoption
  - Good performance
- **Cons**:
  - Less robust JSON support
  - Less advanced constraint checking
  - Some ACID compliance concerns in older versions
- **Why not chosen**: PostgreSQL's superior JSON support and stricter data integrity

### Option 2: MongoDB (NoSQL)
- **Pros**:
  - Flexible schema
  - Easy to scale horizontally
  - Native JSON storage
- **Cons**:
  - No ACID transactions across documents (at time of decision)
  - Harder to enforce referential integrity
  - Less suitable for complex joins
- **Why not chosen**: Medical data requires ACID compliance and strong integrity guarantees

### Option 3: SQLite
- **Pros**:
  - Simple, embedded
  - No server required
  - Good for development
- **Cons**:
  - Not suitable for production with multiple users
  - Limited concurrency
  - No network access
- **Why not chosen**: Production system needs proper database server

### Option 4: Microsoft SQL Server
- **Pros**:
  - Enterprise features
  - Tight Microsoft integration
  - Strong tooling
- **Cons**:
  - Licensing costs
  - Windows-centric
  - Heavier infrastructure
- **Why not chosen**: Cost and open-source preference

## Implementation Details

### Database Schema Highlights
```sql
-- Treatments table with proper constraints
CREATE TABLE treatments (
  id SERIAL PRIMARY KEY,
  order_num VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  priority_data JSONB -- Flexible Priority API data
);

-- Indexes for performance
CREATE INDEX idx_treatments_status ON treatments(status);
CREATE INDEX idx_treatments_user_id ON treatments(user_id);
CREATE INDEX idx_treatments_created_at ON treatments(created_at);

-- Triggers for audit logging
CREATE TRIGGER treatment_audit_trigger
AFTER INSERT OR UPDATE ON treatments
FOR EACH ROW EXECUTE FUNCTION create_audit_log();
```

### Sequelize Configuration
```typescript
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});
```

## Related Decisions

- ADR-002: Priority ERP Integration (relies on PostgreSQL for caching)
- ADR-007: Test Data Strategy (uses separate PostgreSQL database)

## References

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Sequelize TypeScript Documentation](https://sequelize.org/docs/v6/other-topics/typescript/)
- [DATABASE_DESIGN_GUIDE.md](../database/DATABASE_DESIGN_GUIDE.md)
- [backend/src/config/database.ts](../../../backend/src/config/database.ts)

## Review History

- **2024-09-01**: Initial decision during project setup
- **2025-10-16**: Retroactive ADR documentation created

## Notes

This decision has proven sound over months of development. PostgreSQL's reliability and ACID compliance have been crucial for maintaining medical data integrity. The JSON support has been valuable for storing flexible Priority API responses.

Future considerations:
- Monitor performance as treatment data grows
- Consider read replicas if query load increases
- Evaluate partitioning for large tables
