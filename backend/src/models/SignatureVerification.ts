import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

// SignatureVerification attributes interface
interface SignatureVerificationAttributes {
  id: string;
  treatmentId: string;
  targetEmail: string;
  verificationCode: string;
  verificationExpires: Date;
  failedAttempts: number;
  status: 'pending' | 'verified' | 'expired' | 'failed';
  signerName: string | null;
  signerPosition: string | null;
}

// For creating a new SignatureVerification
type SignatureVerificationCreationAttributes = Optional<SignatureVerificationAttributes, 'id' | 'failedAttempts' | 'status' | 'signerName' | 'signerPosition'>

class SignatureVerification extends Model<SignatureVerificationAttributes, SignatureVerificationCreationAttributes> implements SignatureVerificationAttributes {
  public id!: string;
  public treatmentId!: string;
  public targetEmail!: string;
  public verificationCode!: string;
  public verificationExpires!: Date;
  public failedAttempts!: number;
  public status!: 'pending' | 'verified' | 'expired' | 'failed';
  public signerName!: string | null;
  public signerPosition!: string | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association methods (will be defined in index.ts)
  public getTreatment!: () => Promise<any>;

  /**
   * Generate a new verification code for signature
   * Sets 1-hour expiration (longer than login codes)
   */
  public async generateCode(): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(code, 10);

    // Set expiration (1 hour from now for signature verification)
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);

    this.verificationCode = hashedCode;
    this.verificationExpires = expiration;
    this.failedAttempts = 0;
    this.status = 'pending';
    await this.save();

    return code;
  }

  /**
   * Verify a code attempt
   * Returns true if valid, false otherwise
   * Tracks failed attempts and marks as failed after 3 attempts
   */
  public async verifyCode(code: string): Promise<boolean> {
    // Check if already verified or failed
    if (this.status === 'verified') {
      return false; // Already used
    }
    if (this.status === 'failed') {
      return false; // Too many attempts
    }

    // Check expiration
    if (new Date() > this.verificationExpires) {
      this.status = 'expired';
      await this.save();
      return false;
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, this.verificationCode);

    if (isValid) {
      this.status = 'verified';
      await this.save();
      return true;
    } else {
      this.failedAttempts += 1;
      if (this.failedAttempts >= 3) {
        this.status = 'failed';
      }
      await this.save();
      return false;
    }
  }

  /**
   * Get remaining attempts
   */
  public getRemainingAttempts(): number {
    return Math.max(0, 3 - this.failedAttempts);
  }

  /**
   * Check if verification is still valid (not expired, not failed, not verified)
   */
  public isStillValid(): boolean {
    if (this.status !== 'pending') {
      return false;
    }
    if (new Date() > this.verificationExpires) {
      return false;
    }
    return true;
  }
}

SignatureVerification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    treatmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'treatment_id',
      references: {
        model: 'treatments',
        key: 'id',
      },
    },
    targetEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'target_email',
    },
    verificationCode: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'verification_code',
    },
    verificationExpires: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'verification_expires',
    },
    failedAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_attempts',
    },
    status: {
      type: DataTypes.ENUM('pending', 'verified', 'expired', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    signerName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'signer_name',
    },
    signerPosition: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'signer_position',
    },
  },
  {
    sequelize,
    modelName: 'SignatureVerification',
    tableName: 'signature_verifications',
    timestamps: true,
    indexes: [
      {
        fields: ['treatment_id'],
      },
      {
        fields: ['target_email'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['verification_expires'],
      },
    ],
  }
);

export default SignatureVerification;
