// server/api/notify.js
import express from 'express';
import { verifyToken, verifyAdmin } from './auth.js';

const router = express.Router();

// Stockage simple des emails (en mémoire pour l'instant)
// En production, utilise une base de données
let notifications = [];

router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    
    // Vérifier si l'email existe déjà
    if (!notifications.includes(email)) {
      notifications.push(email);
      console.log(`📧 Nouvelle notification demandée: ${email}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route admin pour voir les emails (optionnel)
router.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  res.json({ emails: notifications, count: notifications.length });
});

export default router;