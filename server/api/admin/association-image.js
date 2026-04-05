import express from 'express';
import AssociationIcon from '../../models/AssociationIcon.js';
import { verifyToken, verifyAdmin, verifyAdminPermissionByMethod } from '../auth.js';

const router = express.Router();
router.use(verifyToken, verifyAdmin, verifyAdminPermissionByMethod('association'));

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const items = await AssociationIcon.find().sort({ dateAjout: -1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/count', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const count = await AssociationIcon.countDocuments();
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payload = {
      motFrancais: String(req.body?.motFrancais || '').trim(),
      motBandenkop: String(req.body?.motBandenkop || '').trim(),
      iconUrl: String(req.body?.iconUrl || '').trim(),
      iconSvg: String(req.body?.iconSvg || '').trim(),
      categorie: req.body?.categorie || 'objet',
      niveau: req.body?.niveau || 'debutant',
      points: Number(req.body?.points || 1)
    };

    if (!payload.motFrancais || !payload.motBandenkop) {
      return res.status(400).json({ error: 'Les mots français et Bandenkop sont obligatoires' });
    }

    if (!payload.iconUrl && !payload.iconSvg) {
      return res.status(400).json({ error: 'Ajoutez un lien d’icône ou un code SVG' });
    }

    const item = new AssociationIcon(payload);
    await item.save();
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payload = {
      motFrancais: String(req.body?.motFrancais || '').trim(),
      motBandenkop: String(req.body?.motBandenkop || '').trim(),
      iconUrl: String(req.body?.iconUrl || '').trim(),
      iconSvg: String(req.body?.iconSvg || '').trim(),
      categorie: req.body?.categorie || 'objet',
      niveau: req.body?.niveau || 'debutant',
      points: Number(req.body?.points || 1)
    };

    if (!payload.motFrancais || !payload.motBandenkop) {
      return res.status(400).json({ error: 'Les mots français et Bandenkop sont obligatoires' });
    }

    if (!payload.iconUrl && !payload.iconSvg) {
      return res.status(400).json({ error: 'Ajoutez un lien d’icône ou un code SVG' });
    }

    const item = await AssociationIcon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!item) return res.status(404).json({ error: 'Élément introuvable' });
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await AssociationIcon.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
