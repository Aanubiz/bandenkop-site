import mongoose from 'mongoose';

const reponseSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  reponseJuste: { type: Boolean, required: true },
  tempsReponse: Number,
  date: { type: Date, default: Date.now }
});

const objectifSchema = new mongoose.Schema({
  questions: { type: Number, default: 10 },
  temps: { type: Number, default: 15 }, // en minutes
  date: { type: Date, default: Date.now }
});

const progressionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  rubrique: { 
    type: String, 
    enum: ['quiz', 'prononciation', 'ecriture', 'phonetique', 'association', 'association-image'],
    required: true,
    index: true
  },
  niveau: {
    type: String,
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  points: { type: Number, default: 0 },
  reponses: [reponseSchema],
  questionsReussies: { type: Number, default: 0 },
  questionsRatees: { type: Number, default: 0 },
  serieActuelle: { type: Number, default: 0 },
  meilleureSerie: { type: Number, default: 0 },
  derniereActivite: { type: Date, default: Date.now },
  objectifs: objectifSchema,
  statistiques: {
    tempsTotal: { type: Number, default: 0 }, // en secondes
    sessions: { type: Number, default: 0 },
    derniereSession: Date
  }
}, {
  timestamps: true
});

// Index unique pour éviter les doublons
progressionSchema.index({ userId: 1, rubrique: 1 }, { unique: true });

// Méthode pour calculer le taux de réussite
progressionSchema.methods.getTauxReussite = function() {
  const total = this.questionsReussies + this.questionsRatees;
  return total > 0 ? (this.questionsReussies / total) * 100 : 0;
};

// Méthode pour mettre à jour le niveau
progressionSchema.methods.mettreAJourNiveau = function() {
  const taux = this.getTauxReussite();
  if (taux > 80 && this.questionsReussies > 50) {
    this.niveau = 'avance';
  } else if (taux > 50 && this.questionsReussies > 20) {
    this.niveau = 'intermediaire';
  }
};

// 1. Créer le modèle
const Progression = mongoose.model('Progression', progressionSchema);

// 2. Exporter par défaut (C'EST ÇA QUI CHANGE)
export default Progression;