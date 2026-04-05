import express from 'express';
import AssociationIcon from '../models/AssociationIcon.js';
import Progression from '../models/Progression.js';
import User from '../models/User.js';
import { verifyToken } from './auth.js';

const router = express.Router();

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

router.get('/exercices', verifyToken, async (req, res) => {
  try {
    const { niveau = 'debutant', limite = 3, page = 1 } = req.query;
    const limitNum = Math.min(Number(limite) || 3, 3);
    const pageNum = Number(page) || 1;

    const progression = await Progression.findOne({ userId: req.userId, rubrique: 'association-image' })
      .select('reponses.questionId');

    const seenIds = (progression?.reponses || []).map((r) => r.questionId).filter(Boolean);

    let filter = { niveau };
    let total = await AssociationIcon.countDocuments(filter);
    if (total === 0) {
      filter = {};
      total = await AssociationIcon.countDocuments(filter);
    }

    const unseenFilter = seenIds.length
      ? { ...filter, _id: { $nin: seenIds } }
      : { ...filter };

    const unseenCount = await AssociationIcon.countDocuments(unseenFilter);

    const unseenPipeline = [
      { $match: unseenFilter },
      { $sample: { size: limitNum } }
    ];

    let items = await AssociationIcon.aggregate(unseenPipeline);

    if (items.length < limitNum) {
      const fillPipeline = [
        { $match: filter },
        { $sample: { size: limitNum - items.length } }
      ];
      const fillItems = await AssociationIcon.aggregate(fillPipeline);
      const seen = new Set(items.map((i) => String(i._id)));
      for (const item of fillItems) {
        if (!seen.has(String(item._id))) {
          items.push(item);
          seen.add(String(item._id));
        }
      }
    }

    if (!items.length) {
      return res.status(404).json({ error: 'Aucune association image disponible' });
    }

    return res.json({
      exercices: items.slice(0, limitNum).map((item) => ({
        _id: item._id,
        motFrancais: item.motFrancais,
        motBandenkop: item.motBandenkop,
        iconUrl: item.iconUrl || '',
        iconSvg: item.iconSvg || '',
        categorie: item.categorie,
        niveau: item.niveau,
        points: 1
      })),
      page: pageNum,
      limit: limitNum,
      hasMore: unseenCount > limitNum
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/valider-bloc', verifyToken, async (req, res) => {
  try {
    const { answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Aucune réponse fournie' });
    }

    const ids = answers.map((a) => a?.frId).filter(Boolean);
    const items = await AssociationIcon.find({ _id: { $in: ids } });
    const byId = new Map(items.map((i) => [String(i._id), i]));

    let bonnes = 0;
    let pointsGagnes = 0;
    const details = [];

    let progression = await Progression.findOne({ userId: req.userId, rubrique: 'association-image' });
    if (!progression) progression = new Progression({ userId: req.userId, rubrique: 'association-image' });

    for (const answer of answers) {
      const frItem = byId.get(String(answer?.frId));
      const iconItem = byId.get(String(answer?.iconId));
      const bkItem = byId.get(String(answer?.bkId));
      if (!frItem || !iconItem || !bkItem) continue;

      const estJuste = String(frItem._id) === String(iconItem._id)
        && String(frItem._id) === String(bkItem._id)
        && normalize(frItem.motBandenkop) === normalize(bkItem.motBandenkop);

      progression.reponses.push({
        questionId: frItem._id,
        reponseJuste: estJuste,
        tempsReponse: Number(answer?.tempsReponse || 0)
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
        frId: frItem._id,
        estJuste,
        attendu: frItem.motBandenkop,
        points: estJuste ? 1 : 0
      });
    }

    progression.derniereActivite = new Date();
    progression.mettreAJourNiveau();
    await progression.save();

    if (pointsGagnes > 0) {
      await User.findByIdAndUpdate(req.userId, { $inc: { 'statistiques.totalPoints': pointsGagnes } });
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
