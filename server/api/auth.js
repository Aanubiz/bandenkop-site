import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
import Progression from '../models/Progression.js'; 
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import crypto from 'crypto';

const router = express.Router();

export const ADMIN_ACTIONS = {
  VIEW: 'view',
  EDIT: 'edit'
};

const syncUserTotalPoints = async (userId) => {
  const totalFromProgressions = await Progression.aggregate([
    { $match: { userId } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } }
  ]);

  const totalPoints = Number(totalFromProgressions?.[0]?.total || 0);

  await User.findByIdAndUpdate(userId, {
    $set: { 'statistiques.totalPoints': totalPoints }
  });

  return totalPoints;
};

// ✅ FONCTION DE SÉCURITÉ POUR RESEND (Évite le crash au démarrage)
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_123' || apiKey.includes('YOUR_API_KEY')) {
    console.error("❌ Erreur : RESEND_API_KEY est absente ou invalide dans le .env");
    return null;
  }
  return new Resend(apiKey);
};

const hashCode = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const sendRegistrationCodeEmail = async ({ email, prenom, code }) => {
  const resend = getResend();
  if (!resend) {
    throw new Error('Service email temporairement indisponible. Réessayez plus tard.');
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Bandenkop <noreply@bandenkoponline.com>',
    to: [email],
    subject: 'Code de vérification - Inscription Bandenkop',
    html: `
      <h2>Bonjour ${prenom},</h2>
      <p>Votre code de vérification est :</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 2px;">${code}</p>
      <p>Ce code expire dans 15 minutes.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    `
  });
};

const sendWelcomeEmail = async ({ email, prenom }) => {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Bandenkop <noreply@bandenkoponline.com>',
      to: [email],
      subject: 'Bienvenue sur Bandenkop 🎉',
      html: `
        <h2>Bienvenue ${prenom} !</h2>
        <p>Votre inscription est confirmée. Votre compte Bandenkop est maintenant actif.</p>
        <p>Vous pouvez supprimer votre compte à tout moment depuis votre profil, section paramètres.</p>
        <p>Merci de faire vivre la communauté Bandenkop ❤️</p>
      `
    });
  } catch (error) {
    console.error('Erreur email de bienvenue:', error.message);
  }
};

// 1. Middlewares
export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId)
      .select('role quartier adminScope adminPermissions tokenVersion');

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    const jwtVersion = Number(decoded.tokenVersion ?? 0);
    const currentVersion = Number(user.tokenVersion ?? 0);
    if (jwtVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
    }

    req.userId = decoded.userId;
    req.userRole = user.role;
    req.userQuartier = user.quartier;
    req.userAdminScope = user.adminScope || 'super';
    req.userAdminPermissions = user.adminPermissions || [];
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

const hasAdminPermission = (scope, permissions, resource, action) => {
  // Compatibilité: tout admin sans scope explicite reste super admin
  if (!scope || scope === 'super') return true;
  const perms = Array.isArray(permissions) ? permissions : [];
  if (perms.includes(`${resource}:edit`)) return true;
  if (action === ADMIN_ACTIONS.VIEW && perms.includes(`${resource}:view`)) return true;
  return false;
};

export const verifyAdminPermission = (resource, action = ADMIN_ACTIONS.VIEW) => {
  return (req, res, next) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    if (hasAdminPermission(req.userAdminScope, req.userAdminPermissions, resource, action)) {
      return next();
    }
    return res.status(403).json({ error: 'Permission insuffisante' });
  };
};

export const verifyAdminPermissionByMethod = (resource) => {
  return (req, res, next) => {
    const readMethods = ['GET', 'HEAD', 'OPTIONS'];
    const action = readMethods.includes(req.method) ? ADMIN_ACTIONS.VIEW : ADMIN_ACTIONS.EDIT;
    return verifyAdminPermission(resource, action)(req, res, next);
  };
};

export const verifySuperAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  if (!req.userAdminScope || req.userAdminScope === 'super') {
    return next();
  }
  return res.status(403).json({ error: 'Action réservée au super admin' });
};

// 2. Routes Authentification
router.post('/register', async (req, res) => {
  return res.status(400).json({
    error: 'Inscription en 2 étapes requise',
    code: 'USE_REGISTER_REQUEST_CONFIRM'
  });
});

router.post('/register/request', async (req, res) => {
  try {
    const { prenom, nom, quartier, sexe, email, password } = req.body;
    if (!prenom || !nom || !quartier || !sexe || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    if (password.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères' });

    const emailNormalized = String(email).trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized);
    if (!emailOk) return res.status(400).json({ error: 'Email invalide' });
    
    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) return res.status(400).json({ error: 'Email déjà utilisé' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PendingRegistration.findOneAndUpdate(
      { email: emailNormalized },
      {
        prenom: String(prenom).trim(),
        nom: String(nom).trim(),
        quartier: String(quartier).trim(),
        sexe: String(sexe).trim(),
        email: emailNormalized,
        password: String(password),
        codeHash: hashCode(code),
        attempts: 0,
        expiresAt
      },
      { upsert: true, new: true }
    );

    await sendRegistrationCodeEmail({
      email: emailNormalized,
      prenom: String(prenom).trim(),
      code
    });

    return res.json({
      success: true,
      message: 'Code envoyé par email. Vérifiez votre boîte de réception.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/register/confirm', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const emailNormalized = String(email || '').trim().toLowerCase();
    const codeValue = String(code || '').trim();

    if (!emailNormalized || !codeValue) {
      return res.status(400).json({ error: 'Email et code sont obligatoires' });
    }

    const pending = await PendingRegistration.findOne({ email: emailNormalized });
    if (!pending) {
      return res.status(400).json({ error: 'Aucune demande d’inscription en attente pour cet email' });
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({ error: 'Code expiré. Veuillez relancer l’inscription.' });
    }

    if (pending.codeHash !== hashCode(codeValue)) {
      pending.attempts = Number(pending.attempts || 0) + 1;
      if (pending.attempts >= 5) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res.status(400).json({ error: 'Trop de tentatives. Veuillez relancer l’inscription.' });
      }
      await pending.save();
      return res.status(400).json({ error: 'Code invalide' });
    }

    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    const user = new User({
      prenom: pending.prenom,
      nom: pending.nom,
      quartier: pending.quartier,
      sexe: pending.sexe,
      email: pending.email,
      password: pending.password
    });
    await user.save();

    await PendingRegistration.deleteOne({ _id: pending._id });

    await sendWelcomeEmail({ email: user.email, prenom: user.prenom });
    
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        quartier: user.quartier,
        tokenVersion: Number(user.tokenVersion || 0),
        adminScope: user.adminScope || 'super',
        adminPermissions: user.adminPermissions || []
      },
      process.env.JWT_SECRET || 'secret', { expiresIn: '7d' }
    );
    
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role,
        adminScope: user.adminScope || 'super',
        adminPermissions: user.adminPermissions || []
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    
    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    
    user.derniereConnexion = new Date();
    await user.save();
    
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        quartier: user.quartier,
        tokenVersion: Number(user.tokenVersion || 0),
        adminScope: user.adminScope || 'super',
        adminPermissions: user.adminPermissions || []
      },
      process.env.JWT_SECRET || 'secret', { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role,
        adminScope: user.adminScope || 'super',
        adminPermissions: user.adminPermissions || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Mot de passe oublié (Utilise getResend)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'Si cet email existe, un lien a été envoyé' });

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET + user.password, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetLink = `${process.env.CLIENT_URL || 'https://bandenkoponline.com'}/reinitialiser-mot-de-passe?token=${resetToken}`;

    // ✅ APPEL SÉCURISÉ À RESEND
    const resendInstance = getResend();
    if (!resendInstance) {
      console.log("⚠️ Simulation d'envoi (Pas de clé API) :", resetLink);
      return res.json({ message: 'Email simulé en console (Clé API manquante)' });
    }

    await resendInstance.emails.send({
      from: process.env.EMAIL_FROM || 'Bandenkop <noreply@bandenkoponline.com>',
      to: [user.email],
      subject: 'Réinitialisation de votre mot de passe - Bandenkop',
      html: `<h2>Bonjour ${user.prenom},</h2><p>Cliquez ici : <a href="${resetLink}">${resetLink}</a></p>`
    });

    res.json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Réinitialisation
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.decode(token);
    if (!decoded) return res.status(400).json({ error: 'Token invalide' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(400).json({ error: 'Utilisateur non trouvé' });

    jwt.verify(token, process.env.JWT_SECRET + user.password);

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    res.status(400).json({ error: 'Token invalide ou expiré' });
  }
});

// 5. Profil & Suppression
router.get('/profile', verifyToken, async (req, res) => {
  try {
    await syncUserTotalPoints(req.userId);
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    await Progression.deleteMany({ userId: req.userId });
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Compte supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;