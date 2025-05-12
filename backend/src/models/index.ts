import User from './User';
import Treatment from './Treatment';
import Applicator from './Applicator';

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

export { User, Treatment, Applicator };
