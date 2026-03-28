import express from 'express';
import Prononciation from '../../models/Prononciation.js';
import { verifyToken, verifyAdmin } from '../auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIGURATION MULTER (VERSION CORRIGÉE) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Garde l'extension d'origine
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Version plus permissive du fileFilter
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Augmenté à 20MB
  fileFilter: (req, file, cb) => {
    console.log('📁 Fichier reçu:', file.originalname);
    console.log('📁 Type MIME:', file.mimetype);
    
    // Liste des types MIME audio acceptés
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/mp3', 
      'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/ogg', 'audio/webm', 'audio/aac',
      'audio/x-m4a', 'audio/x-mpeg'
    ];
    
    // Liste des extensions acceptées
    const allowedExts = ['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.aac', '.mp4'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Vérification plus permissive
    if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      console.log('✅ Fichier audio accepté');
      cb(null, true);
    } else {
      console.log('❌ Fichier rejeté - type:', file.mimetype, 'ext:', ext);
      console.log('ℹ️ Types acceptés:', allowedMimeTypes);
      cb(new Error('Format de fichier non supporté. Utilisez MP3, M4A, WAV, OGG, AAC ou WEBM.'));
    }
  }
});

// ===== ROUTES D'UPLOAD (DOIVENT ÊTRE EN PREMIER) =====
router.post('/upload/audio', verifyToken, verifyAdmin, upload.single('audio'), (req, res) => {
  console.log('🔥🔥🔥 ROUTE UPLOAD AUDIO APPELÉE 🔥🔥🔥');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('File:', req.file);
  
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  
  const audioUrl = `/uploads/audio/${req.file.filename}`;
  console.log('✅ URL générée:', audioUrl);
  res.json({ audioUrl });
});

// ===== ROUTES CRUD =====
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await Prononciation.find().sort('-dateAjout');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Prononciation.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!req.body.motFrancais || !req.body.motBandenkop || !req.body.audioUrl) {
      return res.status(400).json({ 
        error: 'Champs requis manquants: motFrancais, motBandenkop, audioUrl' 
      });
    }
    const item = new Prononciation(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = await Prononciation.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!item) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await Prononciation.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES ERREURS MULTER =====
router.use((error, req, res, next) => {
  console.error('❌ Erreur multer:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 20MB)' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

export default router;