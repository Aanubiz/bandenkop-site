import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  contenu: { type: String, required: true },
  resume: { type: String, required: true },
  image: { type: String, default: '/images/default-article.jpg' },
  categorie: { 
    type: String, 
    enum: ['Événement', 'Tradition', 'Développement', 'Diaspora', 'Politique', 'Culture', 'Autre'],
    default: 'Autre'
  },
  auteur: { type: String, required: true },
  datePublication: { type: Date, default: Date.now },
  dateEvenement: Date,
  lieu: String,
  tags: [String],
  estArchive: { type: Boolean, default: false },
  vues: { type: Number, default: 0 },
  featured: { type: Boolean, default: false }
}, {
  timestamps: true
});

articleSchema.index({ datePublication: -1 });
articleSchema.index({ categorie: 1 });
articleSchema.index({ tags: 1 });

// ✅ EXPORT PAR DÉFAUT
const Article = mongoose.model('Article', articleSchema);
export default Article;