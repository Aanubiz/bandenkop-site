import mongoose from 'mongoose';

const cultureArticleSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  periode: String,
  categorie: String,
  image: { type: String, default: '/images/default-article.jpg' },
  resume: { type: String, required: true },
  contenu: { type: String, required: true },
  auteur: { type: String, default: 'Comité culturel de Bandenkop' },
  tags: [String],
  vues: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});

const CultureArticle = mongoose.model('CultureArticle', cultureArticleSchema);
export default CultureArticle;