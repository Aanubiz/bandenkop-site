import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  prenom: { type: String, required: true },
  nom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  quartier: { 
    type: String, 
    enum: ['Denkeng', 'Tsèmeuhia', 'Tsèla'],
    required: true 
  },
  sexe: {
    type: String,
    enum: ['Homme', 'Femme'],
    required: true
  },
  avatar: { type: String, default: '/images/default-avatar.png' },
  bio: String,
  dateNaissance: Date,
  telephone: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  statistiques: {
    totalPoints: { type: Number, default: 0 },
    joursConsecutifs: { type: Number, default: 0 },
    dernierJour: Date,
    rubriquesCompletes: { type: Number, default: 0 }
  },
  classement: {
    quartier: { type: String },
    positionQuartier: Number,
    pointsQuartier: { type: Number, default: 0 }
  },
  dateInscription: { type: Date, default: Date.now },
  derniereConnexion: Date,
  preferences: {
    theme: { type: String, default: 'clair' },
    notifications: { type: Boolean, default: true },
    langue: { type: String, default: 'fr' }
  },
  // ===== AJOUT POUR LA RÉINITIALISATION DU MOT DE PASSE =====
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
}, {
  timestamps: true
});

// Hash du mot de passe
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Méthode pour mettre à jour les statistiques quotidiennes
userSchema.methods.updateDailyStats = function() {
  const aujourdhui = new Date().setHours(0, 0, 0, 0);
  const dernier = this.statistiques.dernierJour?.setHours(0, 0, 0, 0);
  
  if (!dernier || aujourdhui > dernier) {
    if (dernier && aujourdhui - dernier === 86400000) {
      this.statistiques.joursConsecutifs = (this.statistiques.joursConsecutifs || 0) + 1;
    } else {
      this.statistiques.joursConsecutifs = 1;
    }
    this.statistiques.dernierJour = new Date();
  }
};

const User = mongoose.model('User', userSchema);
export default User;