import mongoose from 'mongoose';

const categoriePrononciationSchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true },
  description: String,
  icone: String, // Emoji ou chemin SVG
  couleur: { type: String, default: 'from-orange-500 to-red-500' },
  ordre: { type: Number, default: 0 },
  dateAjout: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

const CategoriePrononciation = mongoose.model('CategoriePrononciation', categoriePrononciationSchema);
export default CategoriePrononciation;