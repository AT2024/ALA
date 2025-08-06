import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

// User attributes interface
interface UserAttributes {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  role: 'hospital' | 'alphatau' | 'admin';
  verificationCode: string | null;
  verificationExpires: Date | null;
  failedAttempts: number;
  lastLogin: Date | null;
  metadata: any; // New field to store Priority user data
}

// For creating a new user
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'verificationCode' | 'verificationExpires' | 'failedAttempts' | 'lastLogin' | 'metadata'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public name!: string;
  public email!: string | null;
  public phoneNumber!: string | null;
  public role!: 'hospital' | 'alphatau' | 'admin';
  public verificationCode!: string | null;
  public verificationExpires!: Date | null;
  public failedAttempts!: number;
  public lastLogin!: Date | null;
  public metadata!: any;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public async generateVerificationCode(): Promise<string> {
    // Always use "123456" as the verification code as requested
    const verificationCode = "123456"; // Fixed code for all environments
    
    // Hash the verification code
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    
    // Set expiration (10 minutes from now)
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 10);
    
    // Update user record
    this.verificationCode = hashedCode;
    this.verificationExpires = expiration;
    await this.save();
    
    return verificationCode;
  }

  public async verifyCode(code: string): Promise<boolean> {
    // Check if verification code exists and is not expired
    if (!this.verificationCode || !this.verificationExpires) {
      return false;
    }
    
    if (new Date() > this.verificationExpires) {
      // Clear expired code
      this.verificationCode = null;
      this.verificationExpires = null;
      await this.save();
      return false;
    }
    
    // Verify the code
    const isValid = await bcrypt.compare(code, this.verificationCode);
    
    if (isValid) {
      // Clear the code on successful verification
      this.verificationCode = null;
      this.verificationExpires = null;
      this.failedAttempts = 0;
      this.lastLogin = new Date();
      await this.save();
    } else {
      // Increment failed attempts
      this.failedAttempts += 1;
      await this.save();
    }
    
    return isValid;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    role: {
      type: DataTypes.ENUM('hospital', 'alphatau', 'admin'),
      allowNull: false,
      defaultValue: 'hospital',
    },
    verificationCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failedAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
  }
);

export default User;