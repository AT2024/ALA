import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Treatment attributes interface
interface TreatmentAttributes {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
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
}

// For creating a new treatment
interface TreatmentCreationAttributes extends Optional<TreatmentAttributes, 'id' | 'isComplete' | 'priorityId' | 'completedBy' | 'completedAt' | 'email' | 'seedQuantity' | 'activityPerSeed' | 'surgeon'> {}

class Treatment extends Model<TreatmentAttributes, TreatmentCreationAttributes> implements TreatmentAttributes {
  public id!: string;
  public type!: 'insertion' | 'removal';
  public subjectId!: string;
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
  },
  {
    sequelize,
    modelName: 'Treatment',
    tableName: 'treatments',
    timestamps: true,
    indexes: [
      {
        fields: ['subjectId'],
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
