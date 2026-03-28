import express from 'express';
import Figure from '../models/Figure.js';
import { verifyToken, verifyAdmin } from './auth.js';

const router = express.Router();

// ===== ROUTES PUBLIQUES =====
// Récupérer les figures par catégorie avec pagination
router.get('/', async (req, res) => {
  try {
    const { categorie, page = 1, limit = 4 } = req.query;
    
    const filter = categorie ? { categorie } : {};
    const figures = await Figure.find(filter)
      .sort({ ordre: 1, dateAjout: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Figure.countDocuments(filter);
    
    res.json({
      figures,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération figures:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer une figure par ID
router.get('/:id', async (req, res) => {
  try {
    const figure = await Figure.findById(req.params.id);
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    res.json(figure);
  } catch (error) {
    console.error('Erreur récupération figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer une figure par slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const figure = await Figure.findOne({ slug: req.params.slug });
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    res.json(figure);
  } catch (error) {
    console.error('Erreur récupération figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTES ADMIN =====
// Créer une figure (admin seulement)
router.post('/admin', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('📝 Création d\'une nouvelle figure...');
    console.log('Données reçues:', req.body);
    
    const figure = new Figure(req.body);
    await figure.save();
    
    console.log('✅ Figure créée avec succès:', figure._id);
    res.status(201).json(figure);
  } catch (error) {
    console.error('❌ Erreur création figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier une figure (admin seulement)
router.put('/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('✏️ Modification de la figure:', req.params.id);
    
    const figure = await Figure.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    
    console.log('✅ Figure modifiée avec succès');
    res.json(figure);
  } catch (error) {
    console.error('❌ Erreur modification figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une figure (admin seulement)
router.delete('/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('🗑️ Suppression de la figure:', req.params.id);
    
    const figure = await Figure.findByIdAndDelete(req.params.id);
    
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    
    console.log('✅ Figure supprimée avec succès');
    res.json({ message: 'Figure supprimée avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== INTERACTIONS UTILISATEURS =====
// Like
router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const figure = await Figure.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    
    res.json({ likes: figure.likes, dislikes: figure.dislikes });
  } catch (error) {
    console.error('Erreur like:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dislike
router.post('/:id/dislike', verifyToken, async (req, res) => {
  try {
    const figure = await Figure.findByIdAndUpdate(
      req.params.id,
      { $inc: { dislikes: 1 } },
      { new: true }
    );
    
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    
    res.json({ likes: figure.likes, dislikes: figure.dislikes });
  } catch (error) {
    console.error('Erreur dislike:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un commentaire
router.post('/:id/commentaires', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const figure = await Figure.findById(req.params.id);
    
    if (!figure) {
      return res.status(404).json({ error: 'Figure non trouvée' });
    }
    
    const commentaire = {
      userId: req.userId,
      nom: user.nom,
      prenom: user.prenom,
      texte: req.body.texte,
      date: new Date()
    };
    
    figure.commentaires.push(commentaire);
    await figure.save();
    
    res.status(201).json(commentaire);
  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;