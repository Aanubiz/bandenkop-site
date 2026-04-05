import mongoose from 'mongoose';

const ecritureSchema = new mongoose.Schema({
  rubrique: { type: String, default: 'ecriture' },
  niveau: { 
    type: String, 
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  type: {
    type: String,
    enum: ['phrase_a_trou', 'traduction', 'composition', 'appariement'],
    required: true
  },
  consigne: { type: String, required: true }, // "Complète la phrase..."
  motFrancais: String,
  motAnglais: String,
  phraseFrancais: String,
  phraseBandenkop: String,
  motsManquants: [{
    position: Number,
    reponse: String,
    indices: [String]
  }],
  options: [String], // Pour les exercices à choix
  reponseAttendue: String,
  imageIndice: String, // Optionnel
  points: { type: Number, default: 10 },
  dateAjout: { type: Date, default: Date.now }
});

export default mongoose.model('Ecriture', ecritureSchema);