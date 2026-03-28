import express from 'express';
import Question from '../models/Question.js';
import Progression from '../models/Progression.js';
import User from '../models/User.js';
import { verifyToken } from './auth.js';

console.log('✅ Fichier quiz.js chargé !');

const router = express.Router();

// Route de test
router.get('/test', (req, res) => {
  console.log('✅ Route /test appelée');
  res.json({ message: 'API quiz fonctionne' });
});

// Récupérer des questions aléatoires
router.get('/questions/:rubrique', verifyToken, async (req, res) => {
  try {
    const { rubrique } = req.params;
    const { niveau = 'debutant', limite = 5 } = req.query;
    
    // Récupérer la progression de l'utilisateur
    const progression = await Progression.findOne({ 
      userId: req.userId, 
      rubrique 
    });
    
    // Questions déjà vues
    const questionsVuesIds = progression?.reponses.map(r => r.questionId) || [];
    
    // Pipeline d'agrégation
    const pipeline = [
      { 
        $match: { 
          rubrique, 
          niveau,
          _id: { $nin: questionsVuesIds }
        }
      },
      { $sample: { size: parseInt(limite) } }
    ];
    
    let questions = await Question.aggregate(pipeline);
    
    // Si pas assez de questions non vues, prendre des anciennes
    if (questions.length < limite) {
      const questionsAnciennes = await Question.aggregate([
        { $match: { rubrique, niveau } },
        { $sort: { dateDerniereUtilisation: 1 } },
        { $limit: limite - questions.length }
      ]);
      questions = [...questions, ...questionsAnciennes];
    }
    
    // Mettre à jour la date d'utilisation
    await Question.updateMany(
      { _id: { $in: questions.map(q => q._id) } },
      { 
        $inc: { utilisations: 1 }, 
        dateDerniereUtilisation: new Date() 
      }
    );
    
    // Nettoyer les réponses pour le client
    const questionsClient = questions.map(q => ({
      _id: q._id,
      rubrique: q.rubrique,
      niveau: q.niveau,
      type: q.type,
      question: q.question,
      options: q.options,
      points: q.points,
      difficulte: q.difficulte
    }));
    
    res.json(questionsClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soumettre une réponse
router.post('/repondre', verifyToken, async (req, res) => {
  try {
    const { questionId, reponse, rubrique, tempsReponse } = req.body;
    
    // Récupérer la question
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }
    
    const estJuste = question.reponse === reponse;
    
    // Récupérer ou créer la progression
    let progression = await Progression.findOne({ 
      userId: req.userId, 
      rubrique 
    });
    
    if (!progression) {
      progression = new Progression({ 
        userId: req.userId, 
        rubrique 
      });
    }
    
    // Ajouter la réponse
    progression.reponses.push({
      questionId,
      reponseJuste: estJuste,
      tempsReponse
    });
    
    if (estJuste) {
      console.log('📊 AVANT incrémentation - serieActuelle:', progression.serieActuelle);
      progression.questionsReussies++;
      progression.points += question.points;
      progression.serieActuelle++;
      console.log('📊 APRÈS incrémentation - serieActuelle:', progression.serieActuelle);
      
      if (progression.serieActuelle > progression.meilleureSerie) {
        progression.meilleureSerie = progression.serieActuelle;
      }
    } else {
      progression.questionsRatees++;
      progression.serieActuelle = 0;
    }
    
    progression.derniereActivite = new Date();
    progression.mettreAJourNiveau();
    await progression.save();
    
    // Mettre à jour le taux de réussite de la question
    const totalReponses = progression.questionsReussies + progression.questionsRatees;
    const tauxReussite = (progression.questionsReussies / totalReponses) * 100;
    
    await Question.findByIdAndUpdate(questionId, { 
      tauxReussite,
      $inc: { utilisations: 1 }
    });
    
    // Mettre à jour les points totaux de l'utilisateur
    if (estJuste) {
      await User.findByIdAndUpdate(req.userId, {
        $inc: { 'statistiques.totalPoints': question.points }
      });
    }
    
    res.json({ 
      estJuste, 
      points: estJuste ? question.points : 0,
      progression: {
        points: progression.points,
        serie: progression.serieActuelle,
        niveau: progression.niveau,
        tauxReussite: progression.getTauxReussite()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer la progression d'une rubrique
router.get('/progression/:rubrique', verifyToken, async (req, res) => {
  try {
    const { rubrique } = req.params;
    
    const progression = await Progression.findOne({ 
      userId: req.userId, 
      rubrique 
    }).populate('reponses.questionId');
    
    if (!progression) {
      return res.json({
        niveau: 'debutant',
        points: 0,
        questionsReussies: 0,
        questionsRatees: 0,
        serieActuelle: 0,
        meilleureSerie: 0
      });
    }
    
    res.json({
      niveau: progression.niveau,
      points: progression.points,
      questionsReussies: progression.questionsReussies,
      questionsRatees: progression.questionsRatees,
      serieActuelle: progression.serieActuelle,
      meilleureSerie: progression.meilleureSerie,
      tauxReussite: progression.getTauxReussite(),
      objectifs: progression.objectifs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;