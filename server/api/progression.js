import express from 'express';
import Progression from '../models/Progression.js';
import User from '../models/User.js';
import { verifyToken } from './auth.js';

const router = express.Router();

// Récupérer toutes les progressions de l'utilisateur
router.get('/', verifyToken, async (req, res) => {
  try {
    const progressions = await Progression.find({ userId: req.userId });
    
    const stats = {
      totalPoints: 0,
      rubriquesCompletes: 0,
      questionsTotales: 0,
      tauxGlobal: 0
    };
    
    progressions.forEach(p => {
      stats.totalPoints += p.points;
      const total = p.questionsReussies + p.questionsRatees;
      stats.questionsTotales += total;
      if (p.niveau === 'avance') stats.rubriquesCompletes++;
    });
    
    stats.tauxGlobal = stats.questionsTotales > 0 
      ? (progressions.reduce((acc, p) => acc + p.questionsReussies, 0) / stats.questionsTotales) * 100 
      : 0;
    
    res.json({
      progressions,
      statistiques: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NOUVELLE ROUTE : Récupérer la progression personnelle pour une rubrique =====
router.get('/user/:rubrique', verifyToken, async (req, res) => {
  try {
    const { rubrique } = req.params;
    
    const progression = await Progression.findOne({ 
      userId: req.userId, 
      rubrique 
    });
    
    if (!progression) {
      return res.json({ 
        progression: 0,
        points: 0,
        niveau: 'debutant',
        questionsReussies: 0,
        questionsRatees: 0,
        totalReponses: 0
      });
    }
    
    // Calculer le pourcentage de progression
    // Objectif quotidien par défaut : 10 questions
    const objectif = progression.objectifs?.questions || 10;
    const totalReponses = progression.questionsReussies + progression.questionsRatees;
    
    // Pourcentage basé sur l'objectif quotidien (max 100%)
    let pourcentage = 0;
    if (totalReponses > 0) {
      pourcentage = Math.min(100, (totalReponses / objectif) * 100);
    }
    
    // Si l'utilisateur a dépassé l'objectif, on garde 100% mais on compte les points supplémentaires
    const points = progression.points || 0;
    
    res.json({
      progression: Math.round(pourcentage),
      points: points,
      niveau: progression.niveau,
      questionsReussies: progression.questionsReussies,
      questionsRatees: progression.questionsRatees,
      totalReponses,
      serieActuelle: progression.serieActuelle || 0,
      meilleureSerie: progression.meilleureSerie || 0
    });
    
  } catch (error) {
    console.error('Erreur progression personnelle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les statistiques quotidiennes
router.get('/quotidien', verifyToken, async (req, res) => {
  try {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    
    const progressions = await Progression.find({ 
      userId: req.userId,
      'reponses.date': { $gte: aujourdhui }
    });
    
    const aujourdhuiCount = progressions.reduce((acc, p) => {
      return acc + p.reponses.filter(r => 
        new Date(r.date) >= aujourdhui
      ).length;
    }, 0);
    
    res.json({
      questionsAujourdhui: aujourdhuiCount,
      objectifQuotidien: 10,
      pourcentage: (aujourdhuiCount / 10) * 100
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer l'historique des 7 derniers jours
router.get('/historique', verifyToken, async (req, res) => {
  try {
    const dates = [];
    const aujourdhui = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(aujourdhui);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const lendemain = new Date(date);
      lendemain.setDate(lendemain.getDate() + 1);
      
      const progressions = await Progression.find({ 
        userId: req.userId,
        'reponses.date': { 
          $gte: date, 
          $lt: lendemain 
        }
      });
      
      const count = progressions.reduce((acc, p) => {
        return acc + p.reponses.filter(r => 
          new Date(r.date) >= date && new Date(r.date) < lendemain
        ).length;
      }, 0);
      
      dates.push({
        date: date.toLocaleDateString('fr-FR'),
        count
      });
    }
    
    res.json(dates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Définir un objectif quotidien
router.post('/objectif', verifyToken, async (req, res) => {
  try {
    const { rubrique, questions, temps } = req.body;
    
    const progression = await Progression.findOneAndUpdate(
      { userId: req.userId, rubrique },
      { 
        objectifs: {
          questions: questions || 10,
          temps: temps || 15,
          date: new Date()
        }
      },
      { new: true, upsert: true }
    );
    
    res.json(progression);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;