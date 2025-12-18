import User from './User';
import Treatment from './Treatment';
import Applicator from './Applicator';
import ApplicatorAuditLog from './ApplicatorAuditLog';
import TreatmentPdf from './TreatmentPdf';
import SignatureVerification from './SignatureVerification';

// Define model associations
User.hasMany(Treatment, {
  foreignKey: 'userId',
  as: 'treatments',
});
Treatment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Treatment.hasMany(Applicator, {
  foreignKey: 'treatmentId',
  as: 'applicators',
  onDelete: 'CASCADE',
});
Applicator.belongsTo(Treatment, {
  foreignKey: 'treatmentId',
  as: 'treatment',
});

User.hasMany(Applicator, {
  foreignKey: 'addedBy',
  as: 'addedApplicators',
});
Applicator.belongsTo(User, {
  foreignKey: 'addedBy',
  as: 'addedByUser',
});

User.hasMany(Applicator, {
  foreignKey: 'removedBy',
  as: 'removedApplicators',
});
Applicator.belongsTo(User, {
  foreignKey: 'removedBy',
  as: 'removedByUser',
});

// Applicator audit log associations
Applicator.hasMany(ApplicatorAuditLog, {
  foreignKey: 'applicatorId',
  as: 'auditLogs',
  onDelete: 'CASCADE',
});
ApplicatorAuditLog.belongsTo(Applicator, {
  foreignKey: 'applicatorId',
  as: 'applicator',
});

// TreatmentPdf associations (one PDF per treatment)
Treatment.hasOne(TreatmentPdf, {
  foreignKey: 'treatmentId',
  as: 'pdf',
  onDelete: 'CASCADE',
});
TreatmentPdf.belongsTo(Treatment, {
  foreignKey: 'treatmentId',
  as: 'treatment',
});

// SignatureVerification associations (can have multiple verification attempts per treatment)
Treatment.hasMany(SignatureVerification, {
  foreignKey: 'treatmentId',
  as: 'signatureVerifications',
  onDelete: 'CASCADE',
});
SignatureVerification.belongsTo(Treatment, {
  foreignKey: 'treatmentId',
  as: 'treatment',
});

export { User, Treatment, Applicator, ApplicatorAuditLog, TreatmentPdf, SignatureVerification };
