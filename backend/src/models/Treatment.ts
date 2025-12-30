import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Treatment attributes interface
interface TreatmentAttributes {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  patientName?: string; // Patient identifier from Priority DETAILS field
  site: string;
  date: Date;
  isComplete: boolean;
  priorityId: string | null; // Reference to Priority system ID
  userId: string; // User who created/owns the treatment
  completedBy: string | null; // User who completed the treatment
  completedAt: Date | null; // When the treatment was completed
  email?: string; // User's email for the treatment
  seedQuantity?: number; // Number of seeds for the treatment
  activityPerSeed?: number; // Activity per seed
  surgeon?: string; // Surgeon performing the treatment
  // Removal procedure fields
  removalDate?: Date;
  allSourcesSameDate?: boolean;
  additionalRemovalDate?: Date;
  reasonNotSameDate?: string;
  discrepancyClarification?: string; // JSON string
  discrepancyDocPath?: string;
  individualSeedsRemoved?: number;
  individualSeedNotes?: string; // JSON string
  removalGeneralComments?: string;
}

// For creating a new treatment
type TreatmentCreationAttributes = Optional<TreatmentAttributes, 'id' | 'isComplete' | 'priorityId' | 'completedBy' | 'completedAt' | 'email' | 'seedQuantity' | 'activityPerSeed' | 'surgeon' | 'patientName' | 'removalDate' | 'allSourcesSameDate' | 'additionalRemovalDate' | 'reasonNotSameDate' | 'discrepancyClarification' | 'discrepancyDocPath' | 'individualSeedsRemoved' | 'individualSeedNotes' | 'removalGeneralComments'>

class Treatment extends Model<TreatmentAttributes, TreatmentCreationAttributes> implements TreatmentAttributes {
  public id!: string;
  public type!: 'insertion' | 'removal';
  public subjectId!: string;
  public patientName?: string;
  public site!: string;
  public date!: Date;
  public isComplete!: boolean;
  public priorityId!: string | null;
  public userId!: string;
  public completedBy!: string | null;
  public completedAt!: Date | null;
  public email?: string;
  public seedQuantity?: number;
  public activityPerSeed?: number;
  public surgeon?: string;
  // Removal procedure fields
  public removalDate?: Date;
  public allSourcesSameDate?: boolean;
  public additionalRemovalDate?: Date;
  public reasonNotSameDate?: string;
  public discrepancyClarification?: string;
  public discrepancyDocPath?: string;
  public individualSeedsRemoved?: number;
  public individualSeedNotes?: string;
  public removalGeneralComments?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly applicators?: any[];
}

Treatment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('insertion', 'removal'),
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'subject_id', // Map to database column name
    },
    patientName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'patient_name', // Map to database column name
    },
    site: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isComplete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_complete', // Map to database column name
    },
    priorityId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'priority_id', // Map to database column name
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id', // Map to database column name
      references: {
        model: 'users',
        key: 'id',
      },
    },
    completedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'completed_by', // Map to database column name
      references: {
        model: 'users',
        key: 'id',
      },
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at', // Map to database column name
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'seed_quantity', // Map to database column name
    },
    activityPerSeed: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'activity_per_seed', // Map to database column name
    },
    surgeon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Removal procedure fields
    removalDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'removal_date',
    },
    allSourcesSameDate: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'all_sources_same_date',
    },
    additionalRemovalDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'additional_removal_date',
    },
    reasonNotSameDate: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reason_not_same_date',
    },
    discrepancyClarification: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'discrepancy_clarification',
    },
    discrepancyDocPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'discrepancy_doc_path',
    },
    individualSeedsRemoved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: 'individual_seeds_removed',
    },
    individualSeedNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'individual_seed_notes',
    },
    removalGeneralComments: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'removal_general_comments',
    },
  },
  {
    sequelize,
    modelName: 'Treatment',
    tableName: 'treatments',
    timestamps: true,
    indexes: [
      {
        fields: ['subject_id'], // Use database column name for indexes
      },
      {
        fields: ['date'],
      },
      {
        fields: ['type'],
      },
    ],
  }
);

export default Treatment;
