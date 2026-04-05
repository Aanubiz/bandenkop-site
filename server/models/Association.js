import mongoose from 'mongoose';

const associationSchema = new mongoose.Schema({
  rubrique: { type: String, default: 'association' },
  blocId: { type: String, index: true },
  niveau: { 
    type: String, 
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  motBandenkop: { type: String, required: true },
  motFrancais: { type: String, required: true },
  motAnglais: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  categorie: { 
    type: String, 
    enum: ['objet', 'animal', 'personne', 'action', 'nature'],
    default: 'objet'
  },
  audioUrl: String, // Prononciation du mot
  points: { type: Number, default: 10 },
  utilisations: { type: Number, default: 0 },
  dateAjout: { type: Date, default: Date.now }
});

export default mongoose.model('Association', associationSchema);