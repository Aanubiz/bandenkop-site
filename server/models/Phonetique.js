import mongoose from 'mongoose';

const phonetiqueSchema = new mongoose.Schema({
  rubrique: { type: String, default: 'phonetique' },
  niveau: { 
    type: String, 
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  son: { type: String, required: true }, // Ex: "ŋ", "ɲ", "ⁿd"
  exempleMot: { type: String, required: true },
  exempleAudio: String,
  description: String,
  positionBouche: String, // Description ou image
  motsPratique: [{
    mot: String,
    audio: String
  }],
  points: { type: Number, default: 8 },
  dateAjout: { type: Date, default: Date.now }
});

export default mongoose.model('Phonetique', phonetiqueSchema);