import express from 'express';
import Article from '../models/Article.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken, verifyAdmin } from './auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/articles'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Route d'upload
router.post('/upload', verifyToken, verifyAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  
  const imageUrl = `/uploads/articles/${req.file.filename}`;
  res.json({ imageUrl });
});

// ===== ROUTE DE TEST =====
router.get('/test', (req, res) => {
  res.json({ message: '✅ API articles fonctionne' });
});

// ===== ROUTES PUBLIQUES =====

// Récupérer les derniers articles (pour la page d'accueil)
router.get('/recent', async (req, res) => {
  try {
    console.log('📰 Route /recent appelée');
    
    const articles = await Article.find({ estArchive: false })
      .sort({ datePublication: -1 })
      .limit(4)
      .select('titre resume image categorie datePublication auteur');
    
    console.log(`✅ ${articles.length} articles trouvés`);
    res.json(articles);
  } catch (error) {
    console.error('❌ Erreur /recent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer tous les articles avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limite = parseInt(req.query.limite) || 5;
    const categorie = req.query.categorie;
    const recherche = req.query.recherche;

    let query = { estArchive: false };
    
    if (categorie) {
      query.categorie = categorie;
    }
    
    if (recherche) {
      query.$or = [
        { titre: { $regex: recherche, $options: 'i' } },
        { contenu: { $regex: recherche, $options: 'i' } },
        { tags: { $in: [new RegExp(recherche, 'i')] } }
      ];
    }

    const total = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .sort({ datePublication: -1 })
      .skip((page - 1) * limite)
      .limit(limite)
      .select('titre resume image categorie datePublication auteur');

    res.json({
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limite)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article spécifique (public)
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { $inc: { vues: 1 } },
      { new: true }
    );
    
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTES ADMIN (protégées) =====

// Récupérer tous les articles pour l'admin (y compris archivés)
router.get('/admin/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const articles = await Article.find().sort({ datePublication: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un article (admin)
router.post('/admin/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('📝 Création d\'un nouvel article:', req.body.titre);
    const article = new Article(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    console.error('❌ Erreur création article:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un article (admin)
router.put('/admin/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('✏️ Modification de l\'article:', req.params.id);
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(article);
  } catch (error) {
    console.error('❌ Erreur modification article:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un article (admin) - suppression définitive
router.delete('/admin/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('🗑️ Suppression de l\'article:', req.params.id);
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression article:', error);
    res.status(500).json({ error: error.message });
  }
});

// Archiver un article (soft delete)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Article.findByIdAndUpdate(req.params.id, { estArchive: true });
    res.json({ message: 'Article archivé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;