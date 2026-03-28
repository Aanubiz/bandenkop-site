import express from 'express';
import Prononciation from '../models/Prononciation.js';
import CategoriePrononciation from '../models/CategoriePrononciation.js';
import { verifyToken, verifyAdmin } from './auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuration multer pour l'upload audio
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/audio/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

// ===== ROUTES PUBLIQUES (avec token) =====

// Récupérer les catégories
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const categories = await CategoriePrononciation.find({ active: true }).sort({ ordre: 1, nom: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les mots avec pagination et filtres
router.get('/mots', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', categorie = '', niveau = '' } = req.query;
    
    const filter = {};
    
    if (categorie) filter.categorie = categorie;
    if (niveau) filter.niveau = niveau;
    
    if (search) {
      filter.$or = [
        { motFrancais: { $regex: search, $options: 'i' } },
        { motBandenkop: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const total = await Prononciation.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    
    const mots = await Prononciation.find(filter)
      .populate('categorie')
      .sort({ dateAjout: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({
      mots,
      total,
      page: Number(page),
      totalPages,
      limit: Number(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer un mot spécifique
router.get('/mots/:id', verifyToken, async (req, res) => {
  try {
    const mot = await Prononciation.findById(req.params.id).populate('categorie');
    if (!mot) {
      return res.status(404).json({ error: 'Mot non trouvé' });
    }
    res.json(mot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTES ADMIN =====

// Upload audio
router.post('/admin/upload/audio', verifyToken, verifyAdmin, upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }
    const audioUrl = `/uploads/audio/${req.file.filename}`;
    res.json({ audioUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestion des catégories
router.get('/admin/categories', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categories = await CategoriePrononciation.find().sort({ ordre: 1, nom: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/categories', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categorie = new CategoriePrononciation(req.body);
    await categorie.save();
    res.status(201).json(categorie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categorie = await CategoriePrononciation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(categorie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Vérifier si des mots utilisent cette catégorie
    const count = await Prononciation.countDocuments({ categorie: req.params.id });
    if (count > 0) {
      return res.status(400).json({ 
        error: `Cette catégorie est utilisée par ${count} mot(s). Veuillez d'abord les re-catégoriser.` 
      });
    }
    await CategoriePrononciation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Catégorie supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestion des mots
router.get('/admin/prononciation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mots = await Prononciation.find().populate('categorie').sort({ dateAjout: -1 });
    res.json(mots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/prononciation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mot = new Prononciation(req.body);
    await mot.save();
    res.status(201).json(mot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/prononciation/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mot = await Prononciation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(mot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/prononciation/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Prononciation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mot supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;