import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Resolution types for sync conflicts
export type ConflictResolution = 'local_wins' | 'server_wins' | 'merged' | 'admin_override';
export type ConflictType = 'version_mismatch' | 'status_conflict' | 'data_conflict' | 'concurrent_edit';
export type ConflictEntityType = 'treatment' | 'applicator';

// SyncConflict attributes interface
interface SyncConflictAttributes {
  id: string;
  entityType: ConflictEntityType;
  entityId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictType: ConflictType;
  deviceId: string;
  userId: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: ConflictResolution;
  overwrittenData?: Record<string, unknown>; // HIPAA audit: what was replaced
}

// For creating a new sync conflict
type SyncConflictCreationAttributes = Optional<SyncConflictAttributes, 'id' | 'createdAt' | 'resolvedAt' | 'resolvedBy' | 'resolution' | 'overwrittenData'>;

class SyncConflict extends Model<SyncConflictAttributes, SyncConflictCreationAttributes> implements SyncConflictAttributes {
  public id!: string;
  public entityType!: ConflictEntityType;
  public entityId!: string;
  public localData!: Record<string, unknown>;
  public serverData!: Record<string, unknown>;
  public conflictType!: ConflictType;
  public deviceId!: string;
  public userId!: string;
  public resolvedAt?: Date;
  public resolvedBy?: string;
  public resolution?: ConflictResolution;
  public overwrittenData?: Record<string, unknown>;

  // Timestamps
  public readonly createdAt!: Date;

  /**
   * Check if this conflict requires admin resolution
   * Medical status conflicts ALWAYS require admin
   */
  public requiresAdminResolution(): boolean {
    const ADMIN_REQUIRED_STATUSES = ['INSERTED', 'FAULTY', 'DISPOSED', 'DEPLOYMENT_FAILURE'];

    if (this.entityType === 'applicator') {
      const localStatus = this.localData?.status as string;
      const serverStatus = this.serverData?.status as string;
      return ADMIN_REQUIRED_STATUSES.includes(localStatus) ||
             ADMIN_REQUIRED_STATUSES.includes(serverStatus);
    }

    // Treatment conflicts always require admin
    if (this.entityType === 'treatment') {
      return true;
    }

    return false;
  }

  /**
   * Check if this conflict is still unresolved
   */
  public isUnresolved(): boolean {
    return this.resolvedAt === null || this.resolvedAt === undefined;
  }
}

SyncConflict.init(
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
    localData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'local_data',
    },
    serverData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'server_data',
    },
    conflictType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'conflict_type',
    },
    deviceId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'device_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'resolved_at',
    },
    resolvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resolved_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    resolution: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    overwrittenData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'overwritten_data',
    },
  },
  {
    sequelize,
    modelName: 'SyncConflict',
    tableName: 'sync_conflicts',
    timestamps: false, // We manage createdAt manually
    indexes: [
      {
        fields: ['entity_type', 'entity_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['resolved_at'],
        where: {
          resolved_at: null,
        },
      },
    ],
  }
);

export default SyncConflict;
