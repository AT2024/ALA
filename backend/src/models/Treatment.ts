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
}

// For creating a new treatment
interface TreatmentCreationAttributes extends Optional<TreatmentAttributes, 'id' | 'isComplete' | 'priorityId' | 'completedBy' | 'completedAt'> {}

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
    },
    priorityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    completedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    completedAt: {
      type: DataTypes.DATE,
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
