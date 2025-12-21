import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ApplicatorStatus, ALL_STATUSES } from '@shared/applicatorStatuses';

// ApplicatorAuditLog attributes interface
interface ApplicatorAuditLogAttributes {
  id: string;
  applicatorId: string;
  oldStatus: ApplicatorStatus | null;
  newStatus: ApplicatorStatus;
  changedBy: string;  // User email
  changedAt: Date;
  reason: string | null;
  requestId: string | null;
}

// For creating a new audit log entry
interface ApplicatorAuditLogCreationAttributes
  extends Optional<ApplicatorAuditLogAttributes, 'id' | 'changedAt' | 'reason' | 'requestId'> {}

class ApplicatorAuditLog
  extends Model<ApplicatorAuditLogAttributes, ApplicatorAuditLogCreationAttributes>
  implements ApplicatorAuditLogAttributes
{
  public id!: string;
  public applicatorId!: string;
  public oldStatus!: ApplicatorStatus | null;
  public newStatus!: ApplicatorStatus;
  public changedBy!: string;
  public changedAt!: Date;
  public reason!: string | null;
  public requestId!: string | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ApplicatorAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    applicatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'applicator_id',
      references: {
        model: 'applicators',
        key: 'id',
      },
    },
    oldStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'old_status',
    },
    newStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'new_status',
      validate: {
        isIn: [ALL_STATUSES],
      },
    },
    changedBy: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'changed_by',
    },
    changedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'changed_at',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'request_id',
    },
  },
  {
    sequelize,
    modelName: 'ApplicatorAuditLog',
    tableName: 'applicator_audit_log',
    timestamps: true,
    indexes: [
      {
        fields: ['applicator_id'],
      },
      {
        fields: ['changed_at'],
      },
      {
        fields: ['request_id'],
      },
      {
        fields: ['applicator_id', 'changed_at'],
        name: 'idx_audit_log_applicator_timeline',
      },
    ],
  }
);

export default ApplicatorAuditLog;
