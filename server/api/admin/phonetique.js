import express from 'express';
import Phonetique from '../../models/Phonetique.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from '../auth.js';

const router = express.Router();
router.use(verifyToken, verifyAdmin, verifyAdminPermissionByMethod('phonetique'));

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await Phonetique.find().sort('-dateAjout');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Phonetique.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = new Phonetique(req.body);
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = await Phonetique.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Phonetique.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;