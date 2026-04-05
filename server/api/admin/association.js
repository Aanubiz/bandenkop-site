import express from 'express';
import Association from '../../models/Association.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from '../auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
router.use(verifyToken, verifyAdmin, verifyAdminPermissionByMethod('association'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/association/images');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `association-image-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/association/audio');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `association-audio-${uniqueSuffix}${path.extname(file.originalname)}`);
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

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac'
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Format audio non supporté'));
  }
});

router.post('/upload/image', verifyToken, verifyAdmin, uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image uploadée' });
  return res.json({ imageUrl: `/api/uploads/association/images/${req.file.filename}` });
});

router.post('/upload/audio', verifyToken, verifyAdmin, uploadAudio.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun audio uploadé' });
  return res.json({ audioUrl: `/api/uploads/association/audio/${req.file.filename}` });
});

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await Association.find().sort('-dateAjout');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/blocs', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await Association.find().sort('-dateAjout');
    const grouped = new Map();

    for (const item of items) {
      const key = item.blocId || String(item._id);
      if (!grouped.has(key)) {
        grouped.set(key, {
          blocId: key,
          isLegacy: !item.blocId,
          categorie: item.categorie,
          niveau: item.niveau,
          dateAjout: item.dateAjout,
          count: 0,
          itemIds: [],
          paires: []
        });
      }

      const bloc = grouped.get(key);
      bloc.count += 1;
      bloc.itemIds.push(String(item._id));
      bloc.paires.push({
        _id: item._id,
        motBandenkop: item.motBandenkop,
        motFrancais: item.motFrancais
      });
    }

    return res.json(Array.from(grouped.values()));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Association.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paires } = req.body || {};

    if (Array.isArray(paires) && paires.length > 0) {
      if (paires.length !== 6) {
        return res.status(400).json({ error: 'Veuillez fournir exactement 6 paires' });
      }

      const blocId = `bloc-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      const toInsert = paires.map((pair) => ({
        rubrique: 'association',
        blocId,
        motBandenkop: String(pair?.motBandenkop || '').trim(),
        motFrancais: String(pair?.motFrancais || '').trim(),
        motAnglais: String(pair?.motAnglais || '').trim(),
        categorie: req.body.categorie || 'objet',
        niveau: req.body.niveau || 'debutant',
        points: 1,
        imageUrl: '',
        audioUrl: ''
      }));

      const invalid = toInsert.find((item) => !item.motBandenkop || !item.motFrancais);
      if (invalid) {
        return res.status(400).json({ error: 'Chaque paire doit contenir un mot Bandenkop et un mot français' });
      }

      const created = await Association.insertMany(toInsert);
      return res.json({ success: true, blocId, createdCount: created.length, items: created });
    }

    const payload = {
      ...req.body,
      imageUrl: req.body?.imageUrl || '',
      points: Number(req.body?.points || 1)
    };

    const item = new Association(payload);
    await item.save();
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/bloc/:blocId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { blocId } = req.params;
    const { paires, categorie, niveau } = req.body || {};

    if (!Array.isArray(paires) || paires.length !== 6) {
      return res.status(400).json({ error: 'Veuillez fournir exactement 6 paires' });
    }

    const existing = await Association.find({ blocId });
    if (!existing.length) {
      return res.status(404).json({ error: 'Bloc introuvable' });
    }

    const toInsert = paires.map((pair) => ({
      rubrique: 'association',
      blocId,
      motBandenkop: String(pair?.motBandenkop || '').trim(),
      motFrancais: String(pair?.motFrancais || '').trim(),
      motAnglais: String(pair?.motAnglais || '').trim(),
      categorie: categorie || existing[0].categorie || 'objet',
      niveau: niveau || existing[0].niveau || 'debutant',
      points: 1,
      imageUrl: '',
      audioUrl: ''
    }));

    const invalid = toInsert.find((item) => !item.motBandenkop || !item.motFrancais);
    if (invalid) {
      return res.status(400).json({ error: 'Chaque paire doit contenir un mot Bandenkop et un mot français' });
    }

    await Association.deleteMany({ blocId });
    const created = await Association.insertMany(toInsert);

    return res.json({ success: true, blocId, updatedCount: created.length, items: created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/bloc/:blocId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { blocId } = req.params;
    const result = await Association.deleteMany({ blocId });
    return res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = await Association.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Association.findByIdAndDelete(req.params.id);
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