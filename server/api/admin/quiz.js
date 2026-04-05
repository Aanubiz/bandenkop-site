import express from 'express';
import Question from '../../models/Question.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from '../auth.js';

const router = express.Router();
router.use(verifyToken, verifyAdmin, verifyAdminPermissionByMethod('quiz'));

const normalizeType = (value) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (v === 'vrai_faux' || v === 'vraifaux' || v === 'vrai/faux') return 'vrai-faux';
  return v;
};

// GET toutes les questions
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { niveau, type } = req.query;
    let query = {};
    if (niveau) query.niveau = niveau;
    if (type) query.type = normalizeType(type);
    
    const questions = await Question.find(query).sort('-dateAjout');
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET compteur
router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Question.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST créer une question
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payload = { ...req.body, type: normalizeType(req.body?.type) };
    const question = new Question(payload);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT modifier une question
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload?.type) payload.type = normalizeType(payload.type);
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true }
    );
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE supprimer une question
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;