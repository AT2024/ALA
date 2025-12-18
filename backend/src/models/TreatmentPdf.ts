import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// TreatmentPdf attributes interface
interface TreatmentPdfAttributes {
  id: string;
  treatmentId: string;
  pdfData: Buffer;
  pdfSizeBytes: number;
  signatureType: 'hospital_auto' | 'alphatau_verified';
  signerName: string;
  signerEmail: string;
  signerPosition: string;
  signedAt: Date;
  emailSentAt: Date | null;
  emailSentTo: string | null;
  emailStatus: 'pending' | 'sent' | 'failed';
}

// For creating a new TreatmentPdf
interface TreatmentPdfCreationAttributes extends Optional<TreatmentPdfAttributes, 'id' | 'emailSentAt' | 'emailSentTo' | 'emailStatus'> {}

class TreatmentPdf extends Model<TreatmentPdfAttributes, TreatmentPdfCreationAttributes> implements TreatmentPdfAttributes {
  public id!: string;
  public treatmentId!: string;
  public pdfData!: Buffer;
  public pdfSizeBytes!: number;
  public signatureType!: 'hospital_auto' | 'alphatau_verified';
  public signerName!: string;
  public signerEmail!: string;
  public signerPosition!: string;
  public signedAt!: Date;
  public emailSentAt!: Date | null;
  public emailSentTo!: string | null;
  public emailStatus!: 'pending' | 'sent' | 'failed';

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association methods (will be defined in index.ts)
  public getTreatment!: () => Promise<any>;
}

TreatmentPdf.init(
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
      unique: true, // One PDF per treatment
    },
    pdfData: {
      type: DataTypes.BLOB('long'), // BYTEA in PostgreSQL for large binary data
      allowNull: false,
      field: 'pdf_data',
    },
    pdfSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pdf_size_bytes',
    },
    signatureType: {
      type: DataTypes.ENUM('hospital_auto', 'alphatau_verified'),
      allowNull: false,
      field: 'signature_type',
    },
    signerName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'signer_name',
    },
    signerEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'signer_email',
    },
    signerPosition: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'signer_position',
    },
    signedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'signed_at',
    },
    emailSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_sent_at',
    },
    emailSentTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'email_sent_to',
    },
    emailStatus: {
      type: DataTypes.ENUM('pending', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'email_status',
    },
  },
  {
    sequelize,
    modelName: 'TreatmentPdf',
    tableName: 'treatment_pdfs',
    timestamps: true,
    indexes: [
      {
        fields: ['treatment_id'],
        unique: true,
      },
      {
        fields: ['email_status'],
      },
      {
        fields: ['signed_at'],
      },
    ],
  }
);

export default TreatmentPdf;
