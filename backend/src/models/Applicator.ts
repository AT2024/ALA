import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Applicator attributes interface
interface ApplicatorAttributes {
  id: string;
  serialNumber: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
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
interface ApplicatorCreationAttributes extends Optional<ApplicatorAttributes, 'id' | 'comments' | 'imagePath' | 'isRemoved' | 'removalComments' | 'removalImagePath' | 'removalTime' | 'removedBy'> {}

class Applicator extends Model<ApplicatorAttributes, ApplicatorCreationAttributes> implements ApplicatorAttributes {
  public id!: string;
  public serialNumber!: string;
  public seedQuantity!: number;
  public usageType!: 'full' | 'faulty' | 'none';
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
    },
    seedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    usageType: {
      type: DataTypes.ENUM('full', 'faulty', 'none'),
      allowNull: false,
      defaultValue: 'full',
    },
    insertionTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isRemoved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    removalComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    removalImagePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    removalTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    treatmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'treatments',
        key: 'id',
      },
    },
    addedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    removedBy: {
      type: DataTypes.UUID,
      allowNull: true,
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
        fields: ['serialNumber'],
      },
      {
        fields: ['treatmentId'],
      },
    ],
  }
);

export default Applicator;
