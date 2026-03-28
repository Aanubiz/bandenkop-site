import mongoose from 'mongoose';

const salonSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: String,
  icone: String,
  type: { type: String, enum: ['public', 'prive', 'quartier'], default: 'public' },
  quartier: String,
  createurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  membres: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  moderateurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  derniereActivite: { type: Date, default: Date.now },
  messagesCount: { type: Number, default: 0 },
  dateCreation: { type: Date, default: Date.now }
});

const Salon = mongoose.model('Salon', salonSchema);
export default Salon;