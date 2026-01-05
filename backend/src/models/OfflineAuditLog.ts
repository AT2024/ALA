import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import crypto from 'crypto';

// Operation types for offline audit
export type OfflineOperation = 'create' | 'update' | 'status_change';
export type OfflineEntityType = 'treatment' | 'applicator';

// OfflineAuditLog attributes interface (HIPAA-compliant)
interface OfflineAuditLogAttributes {
  id: string;
  entityType: OfflineEntityType;
  entityId: string;
  operation: OfflineOperation;
  changedBy: string;
  deviceId: string;
  offlineSince: Date;       // When device went offline
  offlineChangedAt: Date;   // When change was made offline
  syncedAt?: Date;          // When synced to server
  changeHash: string;       // SHA-256 of change payload for integrity
  beforeState?: Record<string, unknown>;
  afterState: Record<string, unknown>;
  conflictResolution?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// For creating a new offline audit log
type OfflineAuditLogCreationAttributes = Optional<OfflineAuditLogAttributes, 'id' | 'createdAt' | 'syncedAt' | 'beforeState' | 'conflictResolution'>;

class OfflineAuditLog extends Model<OfflineAuditLogAttributes, OfflineAuditLogCreationAttributes> implements OfflineAuditLogAttributes {
  public id!: string;
  public entityType!: OfflineEntityType;
  public entityId!: string;
  public operation!: OfflineOperation;
  public changedBy!: string;
  public deviceId!: string;
  public offlineSince!: Date;
  public offlineChangedAt!: Date;
  public syncedAt?: Date;
  public changeHash!: string;
  public beforeState?: Record<string, unknown>;
  public afterState!: Record<string, unknown>;
  public conflictResolution?: string;
  public metadata!: Record<string, unknown>;

  // Timestamps
  public readonly createdAt!: Date;

  /**
   * Calculate the duration of offline period in minutes
   */
  public getOfflineDurationMinutes(): number {
    const syncTime = this.syncedAt || new Date();
    return Math.round((syncTime.getTime() - this.offlineSince.getTime()) / 60000);
  }

  /**
   * Verify the integrity of the change using the stored hash
   */
  public verifyIntegrity(payload: Record<string, unknown>): boolean {
    const computedHash = OfflineAuditLog.computeChangeHash(payload);
    return computedHash === this.changeHash;
  }

  /**
   * Compute SHA-256 hash of a change payload
   */
  public static computeChangeHash(payload: Record<string, unknown>): string {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}

OfflineAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'entity_type',
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'entity_id',
    },
    operation: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    changedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'changed_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    deviceId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'device_id',
    },
    offlineSince: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'offline_since',
    },
    offlineChangedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'offline_changed_at',
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'synced_at',
    },
    changeHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'change_hash',
    },
    beforeState: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'before_state',
    },
    afterState: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'after_state',
    },
    conflictResolution: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'conflict_resolution',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    modelName: 'OfflineAuditLog',
    tableName: 'offline_audit_logs',
    timestamps: false, // We manage createdAt manually
    indexes: [
      {
        fields: ['entity_type', 'entity_id'],
      },
      {
        fields: ['changed_by'],
      },
      {
        fields: ['device_id'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['operation'],
      },
      {
        fields: ['synced_at'],
        where: {
          synced_at: null,
        },
      },
    ],
  }
);

export default OfflineAuditLog;
