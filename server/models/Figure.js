import mongoose from 'mongoose';

const figureSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  categorie: { 
    type: String, 
    enum: ['vivants', 'traces', 'etoiles'],
    required: true 
  },
  photo: { type: String, default: '/images/default-avatar.png' },
  resume: { type: String, required: true },
  biographie: { type: String, required: true },
  naissance: String,
  deces: String,
  quartier: String,
  contributions: [String],
  citations: [String],
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  commentaires: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nom: String,
    prenom: String,
    texte: String,
    date: { type: Date, default: Date.now }
  }],
  ordre: { type: Number, default: 0 },
  dateAjout: { type: Date, default: Date.now }
});

const Figure = mongoose.model('Figure', figureSchema);
export default Figure;