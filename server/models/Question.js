import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  rubrique: { 
    type: String, 
    enum: ['quiz', 'prononciation', 'ecriture', 'phonetique', 'association'],
    required: true,
    index: true
  },
  niveau: {
    type: String,
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant',
    index: true
  },
  type: {
    type: String,
    enum: ['qcm', 'vrai-faux', 'texte', 'audio', 'image', 'dragdrop'],
    required: true
  },
  question: {
    fr: { type: String, required: true },
    bandenkop: String
  },
  options: [String],
  reponse: { type: String, required: true },
  indices: [String],
  image: String,
  audio: String,
  points: { type: Number, default: 10 },
  difficulte: { type: Number, min: 1, max: 5, default: 1 },
  tags: [String],
  dateAjout: { type: Date, default: Date.now },
  dateDerniereUtilisation: Date,
  utilisations: { type: Number, default: 0 },
  tauxReussite: { type: Number, default: 0 }
});

// Création du modèle
const Question = mongoose.model('Question', questionSchema);

// EXPORT PAR DÉFAUT (c'est ce qui manquait)
export default Question;