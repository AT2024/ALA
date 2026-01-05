import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ApplicatorStatus, ALL_STATUSES } from '../../../shared/applicatorStatuses';

// Re-export the type for use by other modules
export type { ApplicatorStatus } from '../../../shared/applicatorStatuses';

// Applicator attributes interface
interface ApplicatorAttributes {
  id: string;
  serialNumber: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  status: ApplicatorStatus | null;
  packageLabel: string | null;
  insertionTime: Date;
  comments: string | null;
  imagePath: string | null;
  isRemoved: boolean;
  removalComments: string | null;
  removalImagePath: string | null;
  removalTime: Date | null;
  treatmentId: string;
  addedBy: string;
  removedBy: string | null;
  // File attachment tracking fields (files stored in Priority ERP, not locally)
  attachmentFilename: string | null;
  attachmentFileCount: number;
  attachmentSizeBytes: number;
  attachmentSyncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | null;
  // Applicator type from Priority PARTS.PARTDES
  applicatorType: string | null;
  // Catalog number from Priority PARTNAME field
  catalog: string | null;
  // Seed length from Priority SIBD_SEEDLEN field
  seedLength: number | null;
  // Offline sync fields
  version: number; // Optimistic locking version
  createdOffline: boolean; // True if created while offline
  syncedAt?: Date; // Last successful sync timestamp
}

// For creating a new applicator
type ApplicatorCreationAttributes = Optional<ApplicatorAttributes, 'id' | 'status' | 'packageLabel' | 'comments' | 'imagePath' | 'isRemoved' | 'removalComments' | 'removalImagePath' | 'removalTime' | 'removedBy' | 'attachmentFilename' | 'attachmentFileCount' | 'attachmentSizeBytes' | 'attachmentSyncStatus' | 'applicatorType' | 'catalog' | 'seedLength' | 'version' | 'createdOffline' | 'syncedAt'>

class Applicator extends Model<ApplicatorAttributes, ApplicatorCreationAttributes> implements ApplicatorAttributes {
  public id!: string;
  public serialNumber!: string;
  public seedQuantity!: number;
  public usageType!: 'full' | 'faulty' | 'none';
  public status!: ApplicatorStatus | null;
  public packageLabel!: string | null;
  public insertionTime!: Date;
  public comments!: string | null;
  public imagePath!: string | null;
  public isRemoved!: boolean;
  public removalComments!: string | null;
  public removalImagePath!: string | null;
  public removalTime!: Date | null;
  public treatmentId!: string;
  public addedBy!: string;
  public removedBy!: string | null;
  // File attachment tracking fields (files stored in Priority ERP, not locally)
  public attachmentFilename!: string | null;
  public attachmentFileCount!: number;
  public attachmentSizeBytes!: number;
  public attachmentSyncStatus!: 'pending' | 'syncing' | 'synced' | 'failed' | null;
  // Applicator type from Priority PARTS.PARTDES
  public applicatorType!: string | null;
  // Catalog number from Priority PARTNAME field
  public catalog!: string | null;
  // Seed length from Priority SIBD_SEEDLEN field
  public seedLength!: number | null;
  // Offline sync fields
  public version!: number;
  public createdOffline!: boolean;
  public syncedAt?: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Applicator.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'serial_number', // Map to database column name
    },
    seedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'seed_quantity', // Map to database column name
    },
    usageType: {
      type: DataTypes.ENUM('full', 'faulty', 'none'),
      allowNull: false,
      defaultValue: 'full',
      field: 'usage_type', // Map to database column name
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true, // Nullable for backward compatibility
      validate: {
        isIn: [ALL_STATUSES],
      },
    },
    packageLabel: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'package_label', // Map to database column name
    },
    insertionTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'insertion_time', // Map to database column name
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagePath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'image_path', // Map to database column name
    },
    isRemoved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_removed', // Map to database column name
    },
    removalComments: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'removal_comments', // Map to database column name
    },
    removalImagePath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'removal_image_path', // Map to database column name
    },
    removalTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'removal_time', // Map to database column name
    },
    treatmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'treatment_id', // Map to database column name
      references: {
        model: 'treatments',
        key: 'id',
      },
    },
    addedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'added_by', // Map to database column name
      references: {
        model: 'users',
        key: 'id',
      },
    },
    removedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'removed_by', // Map to database column name
      references: {
        model: 'users',
        key: 'id',
      },
    },
    // File attachment tracking fields (files stored in Priority ERP, not locally)
    attachmentFilename: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'attachment_filename',
    },
    attachmentFileCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'attachment_file_count',
    },
    attachmentSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'attachment_size_bytes',
    },
    attachmentSyncStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'attachment_sync_status',
    },
    // Applicator type from Priority PARTS.PARTDES
    applicatorType: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'applicator_type',
    },
    // Catalog number from Priority PARTNAME field
    catalog: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'catalog',
    },
    // Seed length from Priority SIBD_SEEDLEN field
    seedLength: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'seed_length',
    },
    // Offline sync fields
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    createdOffline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'created_offline',
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'synced_at',
    },
  },
  {
    sequelize,
    modelName: 'Applicator',
    tableName: 'applicators',
    timestamps: true,
    indexes: [
      {
        fields: ['serial_number'], // Use database column name
      },
      {
        fields: ['treatment_id'], // Use database column name
      },
      {
        fields: ['status'], // Index for workflow state queries
      },
      {
        fields: ['package_label'], // Index for package-level queries
      },
    ],
  }
);

export default Applicator;
