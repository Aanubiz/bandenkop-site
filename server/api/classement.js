import express from 'express';
import User from '../models/User.js';
import Progression from '../models/Progression.js';
import { verifyToken } from './auth.js';

const router = express.Router();

// ===== ROUTE DYNAMIQUE POUR LE CLASSEMENT DES QUARTIERS =====
router.get('/quartiers', verifyToken, async (req, res) => {
  try {
    console.log('📊 Calcul du classement des quartiers...');

    // 1. Agrégation des points par quartier depuis les progressions
    const quartiersStats = await Progression.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id: '$userInfo.quartier',
          totalPoints: { $sum: '$points' },
          membresActifs: { $sum: 1 },
          moyennePoints: { $avg: '$points' },
          // Compter les membres uniques
          membresUniques: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          quartier: '$_id',
          totalPoints: 1,
          membres: { $size: '$membresUniques' },
          moyennePoints: { $round: ['$moyennePoints', 0] }
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    // 2. Agrégation des points par quartier depuis les users (points totaux)
    const usersStats = await User.aggregate([
      {
        $group: {
          _id: '$quartier',
          pointsUtilisateurs: { $sum: '$statistiques.totalPoints' },
          totalMembres: { $sum: 1 }
        }
      }
    ]);

    // Fusionner les deux sources de données
    const classementFinal = quartiersStats.map(quartierStat => {
      const userStat = usersStats.find(u => u._id === quartierStat.quartier) || { pointsUtilisateurs: 0, totalMembres: 0 };

      return {
        nom: quartierStat.quartier,
        points: quartierStat.totalPoints + (userStat.pointsUtilisateurs || 0),
        membres: Math.max(quartierStat.membres, userStat.totalMembres || 0),
        moyenne: quartierStat.moyennePoints || 0,
        meilleurScore: Math.max(
          quartierStat.totalPoints || 0,
          userStat.pointsUtilisateurs || 0
        )
      };
    });

    // Ajouter les quartiers qui n'ont pas de progression mais ont des membres
    usersStats.forEach(userStat => {
      if (!classementFinal.find(c => c.nom === userStat._id)) {
        classementFinal.push({
          nom: userStat._id,
          points: userStat.pointsUtilisateurs || 0,
          membres: userStat.totalMembres || 0,
          moyenne: 0,
          meilleurScore: userStat.pointsUtilisateurs || 0
        });
      }
    });

    // Trier par points
    classementFinal.sort((a, b) => b.points - a.points);

    // 3. Top 3 du jour (utilisateurs avec le plus de points AUJOURD'HUI)
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const demain = new Date(aujourdhui);
    demain.setDate(demain.getDate() + 1);

    const top3 = await Progression.aggregate([
      // Déplier les réponses pour avoir chaque réponse individuellement
      { $unwind: '$reponses' },
      // Filtrer les réponses d'aujourd'hui
      {
        $match: {
          'reponses.date': {
            $gte: aujourdhui,
            $lt: demain
          }
        }
      },
      // Grouper par utilisateur
      {
        $group: {
          _id: '$userId',
          pointsAujourdhui: {
            $sum: {
              $cond: [
                { $eq: ['$reponses.reponseJuste', true] },
                10, // Points par bonne réponse (à ajuster)
                0
              ]
            }
          },
          reponsesAujourdhui: { $sum: 1 }
        }
      },
      // Récupérer les infos utilisateur
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      // Trier par points du jour
      { $sort: { pointsAujourdhui: -1 } },
      // Limiter à 3
      { $limit: 3 },
      // Projeter les champs nécessaires
      {
        $project: {
          prenom: '$user.prenom',
          nom: '$user.nom',
          quartier: '$user.quartier',
          pointsAujourdhui: 1,
          reponsesAujourdhui: 1
        }
      }
    ]);

    console.log('✅ Classement calculé:', classementFinal);
    console.log('🏆 Top 3 du jour:', top3);

    res.json({
      quartiers: classementFinal,
      top3: top3.map(u => ({
        prenom: u.prenom,
        nom: u.nom,
        quartier: u.quartier,
        points: u.pointsAujourdhui || 0,
        reponses: u.reponsesAujourdhui || 0
      }))
    });

  } catch (error) {
    console.error('❌ Erreur classement:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CLASSEMENT GLOBAL DES UTILISATEURS (AVEC SÉRIE CORRIGÉE) =====
router.get('/global', verifyToken, async (req, res) => {
  try {
    console.log('🚀 Route /global appelée par utilisateur:', req.userId);

    // Récupérer tous les utilisateurs
    const utilisateurs = await User.find()
      .select('prenom nom email quartier statistiques')
      .lean();

    // Récupérer toutes les progressions
    const progressions = await Progression.find().lean();

    // Créer un map des points par utilisateur
    const pointsParUtilisateur = {};
    progressions.forEach(prog => {
      const userId = prog.userId.toString();
      if (!pointsParUtilisateur[userId]) {
        pointsParUtilisateur[userId] = 0;
      }
      pointsParUtilisateur[userId] += prog.points || 0;
    });

    // ===== CALCUL CORRIGÉ DES SÉRIES =====
// ===== CALCUL CORRIGÉ DES SÉRIES (VERSION ULTIME) =====
const seriesParUtilisateur = {};
const aujourdhui = new Date();
aujourdhui.setHours(0, 0, 0, 0);

console.log(`📅 Aujourd'hui: ${aujourdhui.toLocaleDateString()}`);

// 1. D'abord, mettre TOUS les utilisateurs à 0 par défaut
utilisateurs.forEach(user => {
  seriesParUtilisateur[user._id.toString()] = 0;
});

// 2. Ensuite, pour ceux qui ont joué AUJOURD'HUI, mettre leur vraie série
progressions.forEach(prog => {
  const userId = prog.userId.toString();
  
  if (prog.reponses && prog.reponses.length > 0) {
    // Vérifier si l'utilisateur a joué aujourd'hui
    const aJoueAujourdhui = prog.reponses.some(r => {
      const dateReponse = new Date(r.date);
      dateReponse.setHours(0, 0, 0, 0);
      return dateReponse.getTime() === aujourdhui.getTime();
    });
    
    if (aJoueAujourdhui) {
      // Il a joué aujourd'hui, on met sa série
      seriesParUtilisateur[userId] = prog.serieActuelle || 0;
      console.log(`✅ Utilisateur ${userId} a joué aujourd'hui, série = ${prog.serieActuelle}`);
    } else {
      // Il n'a PAS joué aujourd'hui, série = 0 (déjà fait)
      console.log(`❌ Utilisateur ${userId} n'a pas joué aujourd'hui, série = 0`);
    }
  }
});

    // Construire le classement des utilisateurs
    const classementUtilisateurs = utilisateurs
      .map(user => {
        const userId = user._id.toString();
        const pointsFromStats = user.statistiques?.totalPoints || 0;
        const pointsFromProgressions = pointsParUtilisateur[userId] || 0;

        // Prendre le maximum des deux sources (au cas où)
        const points = Math.max(pointsFromStats, pointsFromProgressions);

        return {
          prenom: user.prenom || '',
          nom: user.nom || '',
          email: user.email || '',
          quartier: user.quartier || 'Non défini',
          points: points,
          serie: seriesParUtilisateur[userId] || 0, // ← Maintenant c'est correct
          niveau: calculerNiveau(points)
        };
      })
      .filter(user => user.points > 0) // Ne garder que ceux avec des points
      .sort((a, b) => b.points - a.points)
      .slice(0, 8); // 🔥 LIMITÉ À 8 UTILISATEURS SEULEMENT

    // Statistiques par quartier
    const statsQuartiers = {};

    classementUtilisateurs.forEach(user => {
      if (!statsQuartiers[user.quartier]) {
        statsQuartiers[user.quartier] = {
          points: 0,
          membres: 0,
          totalPoints: 0,
          meilleurScore: 0
        };
      }
      statsQuartiers[user.quartier].points += user.points;
      statsQuartiers[user.quartier].membres += 1;
      statsQuartiers[user.quartier].totalPoints += user.points;
      if (user.points > statsQuartiers[user.quartier].meilleurScore) {
        statsQuartiers[user.quartier].meilleurScore = user.points;
      }
    });

    const classementQuartiers = Object.entries(statsQuartiers)
      .map(([nom, stats]) => ({
        nom,
        points: stats.points,
        membres: stats.membres,
        moyenne: stats.membres > 0 ? Math.round(stats.totalPoints / stats.membres) : 0,
        meilleurScore: stats.meilleurScore
      }))
      .sort((a, b) => b.points - a.points);

    console.log('✅ Classement global généré:', {
      utilisateurs: classementUtilisateurs.length,
      quartiers: classementQuartiers.length
    });

    res.json({
      utilisateurs: classementUtilisateurs,
      quartiers: classementQuartiers
    });

  } catch (error) {
    console.error('❌ Erreur classement global:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CLASSEMENT PAR RUBRIQUE =====
router.get('/rubrique/:rubrique', verifyToken, async (req, res) => {
  try {
    const { rubrique } = req.params;

    const stats = await Progression.aggregate([
      { $match: { rubrique: rubrique } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $group: {
          _id: '$user.quartier',
          totalPoints: { $sum: '$points' },
          membresActifs: { $sum: 1 },
          moyennePoints: { $avg: '$points' }
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    res.json({
      rubrique,
      classement: stats.map(s => ({
        quartier: s._id,
        points: s.totalPoints || 0,
        membres: s.membresActifs || 0,
        moyenne: Math.round(s.moyennePoints || 0)
      }))
    });
  } catch (error) {
    console.error('Erreur classement rubrique:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== FONCTION UTILITAIRE =====
function calculerNiveau(points) {
  if (points >= 1000) return 'avance';
  if (points >= 500) return 'intermediaire';
  if (points >= 100) return 'debutant';
  return 'novice';
}

export default router;