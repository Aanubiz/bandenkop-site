import express from 'express';
import ArticleHistoire from '../models/ArticleHistoire.js';
import { verifyToken, verifyAdmin } from './auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIGURATION MULTER POUR L'UPLOAD D'IMAGES =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/histoire'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'histoire-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

// ===== ROUTES PUBLIQUES =====

// Récupérer tous les articles (public)
router.get('/articles', async (req, res) => {
  try {
    const articles = await ArticleHistoire.find().sort({ date: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article par slug (public)
router.get('/articles/slug/:slug', async (req, res) => {
  try {
    const article = await ArticleHistoire.findOne({ slug: req.params.slug });
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    // Incrémenter les vues
    article.vues += 1;
    await article.save();
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article par ID (public - pour l'affichage)
router.get('/articles/id/:id', async (req, res) => {
  try {
    const article = await ArticleHistoire.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    article.vues += 1;
    await article.save();
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTES ADMIN (protégées) =====

// Upload d'image
router.post('/upload', verifyToken, verifyAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }
    const imageUrl = `/uploads/histoire/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer tous les articles pour l'admin
router.get('/admin/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const articles = await ArticleHistoire.find().sort({ date: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article par ID pour l'admin
router.get('/admin/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await ArticleHistoire.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un article
router.post('/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = new ArticleHistoire(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    console.error('Erreur création article:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un article
router.put('/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await ArticleHistoire.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json(article);
  } catch (error) {
    console.error('Erreur modification article:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un article
router.delete('/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await ArticleHistoire.findByIdAndDelete(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json({ message: 'Article supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression article:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;