import express from 'express';
import ContactMessage from '../models/ContactMessage.js';
import { verifyToken, verifyAdmin } from './auth.js';
import { Resend } from 'resend';

const router = express.Router();
const CONTACT_DESTINATION_EMAIL = 'contact@bandenkoponline.com';

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 're_123' || key.includes('YOUR_API_KEY')) return null;
  return new Resend(key);
}

async function sendAdminNotificationEmail(payload) {
  const resend = getResendClient();
  if (!resend) return;

  const to = CONTACT_DESTINATION_EMAIL;
  const from = process.env.EMAIL_FROM || 'noreply@bandenkoponline.com';

  try {
    await resend.emails.send({
      from,
      to,
      replyTo: payload.email,
      subject: `📩 Nouveau message contact - ${payload.subject}`,
      html: `
        <h2>Nouveau message reçu depuis le site</h2>
        <p><strong>Nom:</strong> ${payload.nom}</p>
        <p><strong>Email:</strong> ${payload.email}</p>
        <p><strong>Sujet:</strong> ${payload.subject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;">${payload.message}</p>
      `
    });
  } catch (error) {
    console.error('Erreur notification email contact:', error.message);
  }
}

router.post('/', async (req, res) => {
  try {
    const { nom, email, subject, message } = req.body || {};

    if (!nom || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
    if (!emailOk) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const contactMessage = new ContactMessage({
      nom: String(nom).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      ip: req.ip || '',
      userAgent: req.get('user-agent') || ''
    });

    await contactMessage.save();

    await sendAdminNotificationEmail({
      nom: contactMessage.nom,
      email: contactMessage.email,
      subject: contactMessage.subject,
      message: contactMessage.message
    });

    return res.status(201).json({
      success: true,
      message: 'Message enregistré avec succès'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/admin/messages', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const status = req.query.status || 'all';

    const query = {};
    if (status === 'unread') query.lu = false;
    if (status === 'read') query.lu = true;

    const total = await ContactMessage.countDocuments(query);
    const unread = await ContactMessage.countDocuments({ lu: false });

    const messages = await ContactMessage.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      messages,
      total,
      unread,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/admin/messages/:id/read', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { lu: true, luLe: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Message introuvable' });
    }

    return res.json({ success: true, message: updated });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/admin/stats', verifyToken, verifyAdmin, async (_req, res) => {
  try {
    const unread = await ContactMessage.countDocuments({ lu: false });
    const total = await ContactMessage.countDocuments();
    return res.json({ unread, total });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

export default router;
