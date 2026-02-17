import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// AuthAuditLog event types for HIPAA compliance tracking
export const AUTH_EVENT_TYPES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'SESSION_TIMEOUT',
  'OTP_REQUEST',
] as const;

export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

// AuthAuditLog attributes interface
interface AuthAuditLogAttributes {
  id: string;
  userId: string | null; // NULL for failed logins (user may not exist)
  eventType: AuthEventType;
  eventTime: Date;
  ipAddress: string | null;
  userAgent: string | null;
  identifier: string | null; // Masked email/phone for privacy
  failureReason: string | null;
  requestId: string | null;
}

// For creating a new audit log entry
type AuthAuditLogCreationAttributes = Optional<
  AuthAuditLogAttributes,
  'id' | 'eventTime' | 'userId' | 'ipAddress' | 'userAgent' | 'identifier' | 'failureReason' | 'requestId'
>;

class AuthAuditLog
  extends Model<AuthAuditLogAttributes, AuthAuditLogCreationAttributes>
  implements AuthAuditLogAttributes
{
  public id!: string;
  public userId!: string | null;
  public eventType!: AuthEventType;
  public eventTime!: Date;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public identifier!: string | null;
  public failureReason!: string | null;
  public requestId!: string | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AuthAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'event_type',
      validate: {
        isIn: [AUTH_EVENT_TYPES as unknown as string[]],
      },
    },
    eventTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'event_time',
    },
    ipAddress: {
      type: DataTypes.STRING(45), // IPv6 max length
      allowNull: true,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
    },
    identifier: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_reason',
    },
    requestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'request_id',
    },
  },
  {
    sequelize,
    modelName: 'AuthAuditLog',
    tableName: 'auth_audit_log',
    timestamps: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['event_time'],
      },
      {
        fields: ['event_type'],
      },
      {
        fields: ['user_id', 'event_time'],
        name: 'idx_auth_audit_user_timeline',
      },
    ],
  }
);

export default AuthAuditLog;
