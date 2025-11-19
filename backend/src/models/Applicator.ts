import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Applicator workflow states (9-state model)
// SEALED → OPENED → LOADED → INSERTED → [DISCHARGED | DISPOSED]
//            ↓         ↓           ↓
//          FAULTY  DEPLOYMENT_FAILURE  UNACCOUNTED
export type ApplicatorStatus =
  | 'SEALED'              // Applicator in unopened package (initial state)
  | 'OPENED'              // Package opened, not yet loaded
  | 'LOADED'              // Loaded into delivery device, ready for insertion
  | 'INSERTED'            // Successfully inserted into patient (terminal success state)
  | 'FAULTY'              // Faulty applicator (terminal state)
  | 'DISPOSED'            // Disposed without use (terminal state)
  | 'DISCHARGED'          // Discharged after use (terminal state)
  | 'DEPLOYMENT_FAILURE'  // Failed deployment attempt (terminal state)
  | 'UNACCOUNTED'         // Lost or unaccounted for (terminal state);

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
}

// For creating a new applicator
interface ApplicatorCreationAttributes extends Optional<ApplicatorAttributes, 'id' | 'status' | 'packageLabel' | 'comments' | 'imagePath' | 'isRemoved' | 'removalComments' | 'removalImagePath' | 'removalTime' | 'removedBy'> {}

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
        isIn: [['SEALED', 'OPENED', 'LOADED', 'INSERTED', 'FAULTY', 'DISPOSED', 'DISCHARGED', 'DEPLOYMENT_FAILURE', 'UNACCOUNTED']],
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
