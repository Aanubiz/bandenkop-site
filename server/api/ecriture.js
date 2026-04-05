import express from 'express';
import Question from '../models/Question.js';
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
    const { niveau = 'debutant', limite = 5, page = 1 } = req.query;
    const limitNum = Number(limite) || 5;
    const pageNum = Number(page) || 1;

    const progression = await Progression.findOne({ userId: req.userId, rubrique: 'ecriture' })
      .select('reponses.questionId');
    const seenIds = (progression?.reponses || []).map((r) => r.questionId).filter(Boolean);

    // Source principale : questions de quiz de type texte (aléatoires)
    let filtreBase = { rubrique: 'quiz', type: 'texte', niveau };
    let totalNiveau = await Question.countDocuments(filtreBase);

    // Fallback : si aucun exercice au niveau demandé, charger sans filtre de niveau
    if (totalNiveau === 0) {
      filtreBase = { rubrique: 'quiz', type: 'texte' };
      totalNiveau = await Question.countDocuments(filtreBase);
    }

    const filtreUnseen = seenIds.length
      ? { ...filtreBase, _id: { $nin: seenIds } }
      : { ...filtreBase };

    const unseenCount = await Question.countDocuments(filtreUnseen);

    let items = await Question.aggregate([
      { $match: filtreUnseen },
      { $sample: { size: limitNum } }
    ]);

    if (items.length < limitNum) {
      const fillItems = await Question.aggregate([
        { $match: filtreBase },
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

    const exercices = items.map((item) => ({
      _id: item._id,
      type: 'texte',
      niveau: item.niveau,
      consigne: item.question?.fr || 'Répondez par écrit',
      phraseFrancais: item.question?.bandenkop || '',
      // Bonus: extraction optionnelle depuis tags: fr:xxx et en:xxx
      motFrancais: Array.isArray(item.tags)
        ? (item.tags.find((t) => String(t).toLowerCase().startsWith('fr:')) || '').replace(/^fr:/i, '')
        : '',
      motAnglais: Array.isArray(item.tags)
        ? (item.tags.find((t) => String(t).toLowerCase().startsWith('en:')) || '').replace(/^en:/i, '')
        : '',
      imageIndice: item.image || '',
      points: item.points,
      reponseAttendue: item.reponse || ''
    }));

    res.json({
      exercices,
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

    const ids = answers
      .map((a) => a?.exerciceId)
      .filter(Boolean);

    const questions = await Question.find({
      _id: { $in: ids },
      rubrique: 'quiz',
      type: 'texte'
    });

    const byId = new Map(questions.map((q) => [String(q._id), q]));

    let progression = await Progression.findOne({ userId: req.userId, rubrique: 'ecriture' });
    if (!progression) {
      progression = new Progression({ userId: req.userId, rubrique: 'ecriture' });
    }

    let bonnes = 0;
    let pointsGagnes = 0;
    const details = [];

    for (const answer of answers) {
      const q = byId.get(String(answer.exerciceId));
      if (!q) continue;

      const attendu = q.reponse || '';
      const estJuste = normalize(answer.reponse) === normalize(attendu);

      progression.reponses.push({
        questionId: q._id,
        reponseJuste: estJuste,
        tempsReponse: Number(answer.tempsReponse || 0)
      });

      if (estJuste) {
        bonnes += 1;
        pointsGagnes += q.points || 10;
        progression.questionsReussies += 1;
        progression.points += q.points || 10;
        progression.serieActuelle += 1;
        if (progression.serieActuelle > progression.meilleureSerie) {
          progression.meilleureSerie = progression.serieActuelle;
        }
      } else {
        progression.questionsRatees += 1;
        progression.serieActuelle = 0;
      }

      details.push({
        exerciceId: q._id,
        estJuste,
        attendu,
        points: estJuste ? (q.points || 10) : 0
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

router.post('/repondre', verifyToken, async (req, res) => {
  try {
    const { exerciceId, reponse, tempsReponse = 0 } = req.body;

    const exercice = await Question.findById(exerciceId);
    if (!exercice) {
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    if (exercice.rubrique !== 'quiz' || exercice.type !== 'texte') {
      return res.status(400).json({ error: 'Cet exercice n\'est pas une question texte du quiz' });
    }

    const attendu = exercice.reponse || '';

    const estJuste = normalize(reponse) === normalize(attendu);

    let progression = await Progression.findOne({ userId: req.userId, rubrique: 'ecriture' });
    if (!progression) {
      progression = new Progression({ userId: req.userId, rubrique: 'ecriture' });
    }

    progression.reponses.push({
      questionId: exercice._id,
      reponseJuste: estJuste,
      tempsReponse
    });

    if (estJuste) {
      progression.questionsReussies += 1;
      progression.points += exercice.points || 10;
      progression.serieActuelle += 1;
      if (progression.serieActuelle > progression.meilleureSerie) {
        progression.meilleureSerie = progression.serieActuelle;
      }

      await User.findByIdAndUpdate(req.userId, {
        $inc: { 'statistiques.totalPoints': exercice.points || 10 }
      });
    } else {
      progression.questionsRatees += 1;
      progression.serieActuelle = 0;
    }

    progression.derniereActivite = new Date();
    progression.mettreAJourNiveau();
    await progression.save();

    return res.json({
      estJuste,
      attendu,
      points: estJuste ? (exercice.points || 10) : 0,
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
