import express from 'express';
import CultureArticle from '../models/CultureArticle.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from './auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../public/uploads/culture');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'culture-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Upload d'image
router.post('/upload', verifyToken, verifyAdmin, verifyAdminPermissionByMethod('culture'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  const imageUrl = `/api/uploads/culture/${req.file.filename}`;
  res.json({ imageUrl });
});

// Récupérer tous les articles culturels
router.get('/articles', async (req, res) => {
  try {
    const articles = await CultureArticle.find().sort({ date: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article par slug
router.get('/articles/:slug', async (req, res) => {
  try {
    const article = await CultureArticle.findOne({ slug: req.params.slug });
    if (!article) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un article par ID (admin)
router.get('/admin/articles/:id', verifyToken, verifyAdmin, verifyAdminPermissionByMethod('culture'), async (req, res) => {
  try {
    const article = await CultureArticle.findById(req.params.id);
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un article (admin)
router.post('/articles', verifyToken, verifyAdmin, verifyAdminPermissionByMethod('culture'), async (req, res) => {
  try {
    const article = new CultureArticle(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modifier un article (admin)
router.put('/articles/:id', verifyToken, verifyAdmin, verifyAdminPermissionByMethod('culture'), async (req, res) => {
  try {
    const article = await CultureArticle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un article (admin)
router.delete('/articles/:id', verifyToken, verifyAdmin, verifyAdminPermissionByMethod('culture'), async (req, res) => {
  try {
    await CultureArticle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;