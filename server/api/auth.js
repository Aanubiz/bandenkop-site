import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Progression from '../models/Progression.js'; // ← AJOUT IMPORTANT
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';


const router = express.Router();

// Initialiser Resend avec ta clé API
const resend = new Resend(process.env.RESEND_API_KEY);

// 1. D'abord, on définit verifyToken (AVANT de l'utiliser)
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userQuartier = decoded.quartier;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

export const verifyAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next();
};

// 2. Ensuite, les routes (qui utilisent verifyToken)
router.post('/register', async (req, res) => {
  try {
    const { prenom, nom, quartier, sexe, email, password } = req.body;

    // Validation du mot de passe
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    if (/\s/.test(password)) {
      return res.status(400).json({ error: 'Le mot de passe ne doit pas contenir d\'espaces' });
    }
    if (/[àáâãäåçèéêëìíîïñòóôõöùúûüýÿ]/.test(password)) {
      return res.status(400).json({ error: 'Le mot de passe ne doit pas contenir d\'accents' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    const user = new User({ prenom, nom, quartier, sexe, email, password });
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, role: user.role, quartier: user.quartier },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        quartier: user.quartier,
        sexe: user.sexe,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    user.derniereConnexion = new Date();
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, role: user.role, quartier: user.quartier },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        quartier: user.quartier,
        sexe: user.sexe,
        role: user.role,
        avatar: user.avatar,
        statistiques: user.statistiques
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. La route /profile qui utilise verifyToken
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour le profil
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { prenom, nom, email, quartier, sexe } = req.body;
    
    // Vérifier si l'email est déjà utilisé par quelqu'un d'autre
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.userId } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { prenom, nom, email, quartier, sexe },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demande de réinitialisation de mot de passe
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      // Pour des raisons de sécurité, on ne dit pas si l'email existe
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    // Générer un token de réinitialisation valide 1 heure
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET + user.password,
      { expiresIn: '1h' }
    );

    // Sauvegarder le token
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
    await user.save();

    // Créer le lien de réinitialisation
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reinitialiser-mot-de-passe?token=${resetToken}`;

    // Envoyer l'email avec Resend
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Bandenkop <noreply@bandenkoponline.com>',
      to: [user.email],
      subject: 'Réinitialisation de votre mot de passe - Bandenkop',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Réinitialisation du mot de passe</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #fff;
            }
            .header {
              background: linear-gradient(135deg, #f97316, #dc2626);
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 28px;
              font-weight: bold;
            }
            .header p {
              color: rgba(255,255,255,0.9);
              margin: 10px 0 0;
            }
            .content {
              padding: 40px 30px;
              background: #fff;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #f97316, #dc2626);
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              margin: 25px 0;
              font-weight: 600;
              transition: transform 0.2s;
            }
            .button:hover {
              transform: scale(1.02);
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .warning {
              background: #fef3c7;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              font-size: 13px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 Bandenkop</h1>
              <p>Village de 2ème degré - Hauts Plateaux</p>
            </div>
            <div class="content">
              <h2>Bonjour ${user.prenom} ${user.nom},</h2>
              <p>Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Bandenkop.</p>
              <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">🔐 Réinitialiser mon mot de passe</a>
              </div>
              <div class="warning">
                <strong>⚠️ Ce lien expirera dans 1 heure.</strong><br>
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
              </div>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280;">
                <strong>Conseil de sécurité :</strong> Utilisez un mot de passe fort et unique. Ne le partagez jamais avec personne.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Bandenkop. Tous droits réservés.</p>
              <p>Village Bandenkop, Arrondissement de Bangou<br>Département des Hauts Plateaux, Ouest Cameroun</p>
              <p style="margin-top: 10px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="color: #f97316; text-decoration: none;">Visitez notre site</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Erreur Resend:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }

    console.log(`📧 Email de réinitialisation envoyé à ${user.email} (ID: ${data?.id})`);
    res.json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur forgot-password:', error);
    res.status(500).json({ error: error.message });
  }
});

// Réinitialisation du mot de passe
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Décoder le token sans vérifier la signature d'abord pour récupérer l'userId
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId) {
      return res.status(400).json({ error: 'Token invalide' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le token avec la clé + ancien mot de passe
    try {
      jwt.verify(token, process.env.JWT_SECRET + user.password);
    } catch (error) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Valider le nouveau mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    if (/\s/.test(newPassword)) {
      return res.status(400).json({ error: 'Le mot de passe ne doit pas contenir d\'espaces' });
    }

    // Changer le mot de passe
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Envoyer un email de confirmation
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Bandenkop <noreply@bandenkoponline.com>',
      to: [user.email],
      subject: 'Votre mot de passe a été changé - Bandenkop',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Mot de passe changé</title>
        </head>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Bandenkop</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
              <h2>Bonjour ${user.prenom} ${user.nom},</h2>
              <p>Votre mot de passe a été changé avec succès.</p>
              <p>Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement.</p>
              <p style="margin-top: 20px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/connexion" style="background: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Se connecter</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`📧 Email de confirmation envoyé à ${user.email}`);

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur reset-password:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer le compte
router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    // Supprimer les progressions
    await Progression.deleteMany({ userId: req.userId });
    
    // Supprimer l'utilisateur
    await User.findByIdAndDelete(req.userId);
    
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demande de réinitialisation de mot de passe
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      // Pour des raisons de sécurité, on ne dit pas si l'email existe
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    // Générer un token de réinitialisation valide 1 heure
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET + user.password, // Ajouter le hash du mot de passe pour invalider après changement
      { expiresIn: '1h' }
    );

    // Sauvegarder le token (optionnel, pour traçabilité)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
    await user.save();

    // TODO: Envoyer un vrai email avec nodemailer
    // Pour l'instant, on simule
    console.log(`📧 Lien de réinitialisation pour ${email}: http://localhost:3000/reinitialiser-mot-de-passe?token=${resetToken}`);

    res.json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur forgot-password:', error);
    res.status(500).json({ error: error.message });
  }
});

// Réinitialisation du mot de passe
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Décoder le token sans vérifier la signature d'abord pour récupérer l'userId
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId) {
      return res.status(400).json({ error: 'Token invalide' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le token avec la clé + ancien mot de passe
    try {
      jwt.verify(token, process.env.JWT_SECRET + user.password);
    } catch (error) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Valider le nouveau mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    if (/\s/.test(newPassword)) {
      return res.status(400).json({ error: 'Le mot de passe ne doit pas contenir d\'espaces' });
    }

    // Changer le mot de passe
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur reset-password:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;