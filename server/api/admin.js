import express from 'express';
import Question from '../models/Question.js';
import User from '../models/User.js';
import Progression from '../models/Progression.js';
import Prononciation from '../models/Prononciation.js';
import CategoriePrononciation from '../models/CategoriePrononciation.js';
import ArticleHistoire from '../models/ArticleHistoire.js';
import Article from '../models/Article.js'; // ← AJOUT IMPORTANT
import Figure from '../models/Figure.js'; // ← AJOUT IMPORTANT
import { verifyToken, verifyAdmin } from './auth.js';

const router = express.Router();

// ===== STATISTIQUES DASHBOARD COMPLÈTES =====
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      nouveauxUsersMois,
      totalQuestions,
      totalAudio,
      totalCategories,
      reponsesAujourdhui,
      questionsParRubrique,
      activite7Jours,
      repartitionRubriques
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        dateInscription: { $gte: new Date(new Date().setDate(1)) }
      }),
      Question.countDocuments({ rubrique: 'quiz' }),
      Prononciation.countDocuments(),
      CategoriePrononciation.countDocuments(),
      Progression.aggregate([
        { $unwind: '$reponses' },
        { 
          $match: { 
            'reponses.date': { 
              $gte: new Date(new Date().setHours(0,0,0,0))
            }
          }
        },
        { $count: 'total' }
      ]).then(r => r[0]?.total || 0),
      Question.aggregate([
        { $group: { _id: '$rubrique', count: { $sum: 1 } } }
      ]).then(r => {
        const obj = {};
        r.forEach(item => obj[item._id] = item.count);
        return obj;
      }),
      Progression.aggregate([
        { $unwind: '$reponses' },
        {
          $match: {
            'reponses.date': {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: { 
              $dateToString: { format: '%d/%m', date: '$reponses.date' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Répartition des questions par rubrique pour le graphique
      Question.aggregate([
        { $group: { _id: '$rubrique', count: { $sum: 1 } } }
      ]).then(r => {
        const obj = {};
        r.forEach(item => obj[item._id] = item.count);
        return obj;
      })
    ]);

    res.json({
      totalUsers,
      nouveauxUsersMois,
      totalQuestions,
      totalAudio,
      totalCategories,
      reponsesAujourdhui,
      questionsParRubrique,
      activite7Jours: activite7Jours.map(j => ({
        date: j._id,
        count: j.count
      })),
      repartitionRubriques
    });

  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ACTIVITÉS RÉCENTES =====
router.get('/activities/recent', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const activities = [];

    // Derniers utilisateurs inscrits
    const nouveauxUtilisateurs = await User.find()
      .sort({ dateInscription: -1 })
      .limit(5)
      .select('prenom nom dateInscription');

    nouveauxUtilisateurs.forEach(u => {
      activities.push({
        id: u._id,
        type: 'user',
        message: `Nouvel utilisateur inscrit : ${u.prenom} ${u.nom}`,
        date: u.dateInscription,
        icone: '👤'
      });
    });

    // Derniers commentaires sur les figures
    const derniersCommentaires = await Figure.aggregate([
      { $unwind: '$commentaires' },
      { $sort: { 'commentaires.date': -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: '$commentaires._id',
          user: { prenom: '$commentaires.prenom', nom: '$commentaires.nom' },
          texte: '$commentaires.texte',
          date: '$commentaires.date',
          type: { $literal: 'commentaire' }
        }
      }
    ]);

    derniersCommentaires.forEach(c => {
      activities.push({
        id: c._id,
        type: 'comment',
        message: `Nouveau commentaire de ${c.user.prenom} ${c.user.nom} : "${c.texte.substring(0, 50)}${c.texte.length > 50 ? '...' : ''}"`,
        date: c.date,
        icone: '💬'
      });
    });

    // Derniers articles actualités
    const derniersArticles = await Article.find()
      .sort({ datePublication: -1 })
      .limit(5)
      .select('titre datePublication');

    derniersArticles.forEach(a => {
      activities.push({
        id: a._id,
        type: 'article',
        message: `Nouvel article publié : ${a.titre}`,
        date: a.datePublication,
        icone: '📰'
      });
    });

    // Dernières figures ajoutées au wiki
    const dernieresFigures = await Figure.find()
      .sort({ dateAjout: -1 })
      .limit(5)
      .select('prenom nom dateAjout');

    dernieresFigures.forEach(f => {
      activities.push({
        id: f._id,
        type: 'figure',
        message: `Nouvelle figure ajoutée : ${f.prenom} ${f.nom}`,
        date: f.dateAjout,
        icone: '👥'
      });
    });

    // Trier par date décroissante et limiter à 10
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivities = activities.slice(0, 10);

    res.json(recentActivities);
  } catch (error) {
    console.error('Erreur activités récentes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES ARTICLES D'HISTOIRE =====
router.get('/histoire/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const articles = await ArticleHistoire.find().sort({ date: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/histoire/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = new ArticleHistoire(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/histoire/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await ArticleHistoire.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/histoire/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await ArticleHistoire.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/histoire/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await ArticleHistoire.findById(req.params.id);
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES ARTICLES D'ACTUALITÉS =====
router.get('/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const articles = await Article.find().sort({ datePublication: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/articles', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = new Article(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/articles/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES FIGURES DU WIKI =====
router.get('/figures', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const figures = await Figure.find().sort({ ordre: 1, dateAjout: -1 });
    res.json(figures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/figures', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const figure = new Figure(req.body);
    await figure.save();
    res.status(201).json(figure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/figures/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const figure = await Figure.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(figure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/figures/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Figure.findByIdAndDelete(req.params.id);
    res.json({ message: 'Figure supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DE LA PRONONCIATION =====
router.get('/prononciation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mots = await Prononciation.find().populate('categorie').sort({ dateAjout: -1 });
    res.json(mots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prononciation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mot = new Prononciation(req.body);
    await mot.save();
    res.status(201).json(mot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/prononciation/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mot = await Prononciation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(mot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/prononciation/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Prononciation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mot supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES CATÉGORIES DE PRONONCIATION =====
router.get('/categories', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categories = await CategoriePrononciation.find().sort({ ordre: 1, nom: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categorie = new CategoriePrononciation(req.body);
    await categorie.save();
    res.status(201).json(categorie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const categorie = await CategoriePrononciation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(categorie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await Prononciation.countDocuments({ categorie: req.params.id });
    if (count > 0) {
      return res.status(400).json({ 
        error: `Cette catégorie est utilisée par ${count} mot(s). Veuillez d'abord les re-catégoriser.` 
      });
    }
    await CategoriePrononciation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Catégorie supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTION DES UTILISATEURS =====
router.get('/utilisateurs', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const utilisateurs = await User.find().select('-password').sort({ dateInscription: -1 });
    res.json(utilisateurs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/utilisateurs/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Progression.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== EXPORT PAR DÉFAUT =====
export default router;