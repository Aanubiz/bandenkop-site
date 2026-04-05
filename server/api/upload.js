import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../public/uploads/figures/');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'figure-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG ou GIF.'));
    }
  }
});

// Upload d'image
router.post('/', verifyToken, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('❌ Upload.js multer error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ Upload.js: Aucun fichier uploadé');
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }
    
    const imageUrl = `/api/uploads/figures/${req.file.filename}`;
    console.log('✅ Upload.js: Image uploadée:', imageUrl);
    
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('❌ Upload.js erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;