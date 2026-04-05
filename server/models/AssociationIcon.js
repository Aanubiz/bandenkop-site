import mongoose from 'mongoose';

const associationIconSchema = new mongoose.Schema({
  rubrique: { type: String, default: 'association' },
  niveau: {
    type: String,
    enum: ['debutant', 'intermediaire', 'avance'],
    default: 'debutant'
  },
  motFrancais: { type: String, required: true, trim: true },
  motBandenkop: { type: String, required: true, trim: true },
  iconUrl: { type: String, default: '' },
  iconSvg: { type: String, default: '' },
  categorie: {
    type: String,
    enum: ['objet', 'animal', 'personne', 'action', 'nature'],
    default: 'objet'
  },
  points: { type: Number, default: 1 },
  dateAjout: { type: Date, default: Date.now }
});

associationIconSchema.index({ motFrancais: 1, motBandenkop: 1, categorie: 1 });

export default mongoose.model('AssociationIcon', associationIconSchema);
