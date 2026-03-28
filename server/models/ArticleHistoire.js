import mongoose from 'mongoose';

const articleHistoireSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  sousTitre: String,
  periode: String,
  chapitre: {
    type: String,
    enum: ['origines', 'formation', 'alliances', 'batailles', 'resistance', 'exil', 'retour', 'reconstruction', 'perspectives']
  },
  contenu: { type: String, required: true },
  imageCouverture: String,
  tags: [String],
  vues: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  telechargements: { type: Number, default: 0 },
  partages: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});

const ArticleHistoire = mongoose.model('ArticleHistoire', articleHistoireSchema);
export default ArticleHistoire;