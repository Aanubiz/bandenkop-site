import mongoose from 'mongoose';

const prononciationSchema = new mongoose.Schema({
  motFrancais: { type: String, required: true },
  motAnglais: { type: String, default: '' },
  motBandenkop: { type: String, required: true },
  audioUrl: { type: String, required: true },
  categorie: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoriePrononciation', required: true },
  niveau: { 
    type: String, 
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  transcriptionPhonetique: String,
  exemplePhrase: {
    francais: String,
    bandenkop: String
  },
  points: { type: Number, default: 5 },
  difficulte: { type: Number, min: 1, max: 5, default: 1 },
  imageUrl: String, // Optionnel, image illustrative
  tags: [String],
  dateAjout: { type: Date, default: Date.now },
  utilisations: { type: Number, default: 0 }
});

// Index pour la recherche
prononciationSchema.index({ motFrancais: 'text', motBandenkop: 'text', tags: 'text' });

const Prononciation = mongoose.model('Prononciation', prononciationSchema);
export default Prononciation;