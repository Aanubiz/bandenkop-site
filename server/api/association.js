import express from 'express';
import Association from '../models/Association.js';
import Progression from '../models/Progression.js';
import User from '../models/User.js';
import { verifyToken } from './auth.js';

const router = express.Router();

const normalize = (value) => {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

router.get('/exercices', verifyToken, async (req, res) => {
  try {
    const { niveau = 'debutant', limite = 6, page = 1 } = req.query;
    const limitNum = Number(limite) || 6;
    const pageNum = Number(page) || 1;

    const progression = await Progression.findOne({ userId: req.userId, rubrique: 'association' })
      .select('reponses.questionId');

    const seenIds = (progression?.reponses || []).map((r) => r.questionId).filter(Boolean);

    let filter = { niveau };
    let total = await Association.countDocuments(filter);
    if (total === 0) {
      filter = {};
      total = await Association.countDocuments(filter);
    }

    const unseenFilter = seenIds.length
      ? { ...filter, _id: { $nin: seenIds } }
      : { ...filter };

    const unseenCount = await Association.countDocuments(unseenFilter);

    let items = await Association.aggregate([
      { $match: unseenFilter },
      { $sample: { size: limitNum } }
    ]);

    if (items.length < limitNum) {
      const fillItems = await Association.aggregate([
        { $match: filter },
        { $sample: { size: limitNum - items.length } }
      ]);

      const existing = new Set(items.map((i) => String(i._id)));
      for (const item of fillItems) {
        if (!existing.has(String(item._id))) {
          items.push(item);
          existing.add(String(item._id));
        }
      }
    }

    res.json({
      exercices: items.map((item) => ({
        _id: item._id,
        motFrancais: item.motFrancais,
        motBandenkop: item.motBandenkop,
        motAnglais: item.motAnglais || '',
        imageUrl: item.imageUrl || '',
        audioUrl: item.audioUrl || '',
        points: 1,
        niveau: item.niveau || 'debutant'
      })),
      page: pageNum,
      limit: limitNum,
      hasMore: unseenCount > limitNum
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/valider-bloc', verifyToken, async (req, res) => {
  try {
    const { answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Aucune réponse fournie' });
    }

    const ids = answers.map((a) => a?.associationId).filter(Boolean);
    const items = await Association.find({ _id: { $in: ids } });
    const byId = new Map(items.map((i) => [String(i._id), i]));

    let progression = await Progression.findOne({ userId: req.userId, rubrique: 'association' });
    if (!progression) {
      progression = new Progression({ userId: req.userId, rubrique: 'association' });
    }

    let bonnes = 0;
    let pointsGagnes = 0;
    const details = [];

    for (const answer of answers) {
      const item = byId.get(String(answer.associationId));
      if (!item) continue;

      const estJuste = normalize(answer.reponseBandenkop) === normalize(item.motBandenkop);

      progression.reponses.push({
        questionId: item._id,
        reponseJuste: estJuste,
        tempsReponse: Number(answer.tempsReponse || 0)
      });

      if (estJuste) {
        bonnes += 1;
        pointsGagnes += 1;
        progression.questionsReussies += 1;
        progression.points += 1;
        progression.serieActuelle += 1;
        if (progression.serieActuelle > progression.meilleureSerie) {
          progression.meilleureSerie = progression.serieActuelle;
        }
      } else {
        progression.questionsRatees += 1;
        progression.serieActuelle = 0;
      }

      details.push({
        associationId: item._id,
        estJuste,
        attendu: item.motBandenkop,
        points: estJuste ? 1 : 0
      });
    }

    progression.derniereActivite = new Date();
    progression.mettreAJourNiveau();
    await progression.save();

    if (pointsGagnes > 0) {
      await User.findByIdAndUpdate(req.userId, {
        $inc: { 'statistiques.totalPoints': pointsGagnes }
      });
    }

    return res.json({
      success: true,
      blocQuestions: answers.length,
      bonnes,
      pointsGagnes,
      details,
      progression: {
        points: progression.points,
        serie: progression.serieActuelle,
        niveau: progression.niveau
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
