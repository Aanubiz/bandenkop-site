import express from 'express';
import Ecriture from '../../models/Ecriture.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from '../auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
router.use(verifyToken, verifyAdmin, verifyAdminPermissionByMethod('ecriture'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/ecriture');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `ecriture-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Format image non supporté'));
  }
});

router.post('/upload/image', verifyToken, verifyAdmin, uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image uploadée' });
  return res.json({ imageUrl: `/api/uploads/ecriture/${req.file.filename}` });
});

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await Ecriture.find().sort('-dateAjout');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Ecriture.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = new Ecriture(req.body);
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = await Ecriture.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Ecriture.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) return res.status(400).json({ error: error.message || 'Erreur upload' });
  return next();
});

export default router;