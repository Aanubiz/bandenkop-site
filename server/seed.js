import mongoose from 'mongoose';
import Question  from './models/Question.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const questions = [
  // Quiz - Débutant
  {
    rubrique: 'quiz',
    niveau: 'debutant',
    type: 'qcm',
    question: { 
      fr: "Que signifie 'Bandenkop' ?",
      bandenkop: ""  // Optionnel, mais peut être vide
    },
    options: ["Ceux qui ont traversé la montagne", "Le village sacré", "La terre des ancêtres"],
    reponse: "Ceux qui ont traversé la montagne",
    points: 10,
    difficulte: 1,
    tags: ['histoire', 'origine']
  },
  {
    rubrique: 'quiz',
    niveau: 'debutant',
    type: 'qcm',
    question: { 
      fr: "Quel est le symbole du chef ?",
      bandenkop: ""
    },
    options: ["Le léopard", "L'éléphant", "Le buffle"],
    reponse: "Le léopard",
    points: 10,
    difficulte: 1,
    tags: ['pouvoir', 'symbole']
  },
  {
    rubrique: 'quiz',
    niveau: 'debutant',
    type: 'qcm',
    question: { 
      fr: "Comment s'appelle le tambour royal ?",
      bandenkop: ""
    },
    options: ["Nkul", "Mengu", "Tchagha"],
    reponse: "Nkul",
    points: 10,
    difficulte: 1,
    tags: ['musique', 'tradition']
  },
  {
    rubrique: 'quiz',
    niveau: 'debutant',
    type: 'qcm',
    question: { 
      fr: "Quelle est la danse des notables ?",
      bandenkop: ""
    },
    options: ["Nkah", "Mfeh", "Khe"],
    reponse: "Nkah",
    points: 10,
    difficulte: 1,
    tags: ['danse', 'notabilité']
  },
  
  // Quiz - Intermédiaire
  {
    rubrique: 'quiz',
    niveau: 'intermediaire',
    type: 'qcm',
    question: { 
      fr: "Qui a fondé Bandenkop ?",
      bandenkop: ""
    },
    options: ["Le fondateur légendaire", "Chef Ndefo", "Mama Ngou"],
    reponse: "Le fondateur légendaire",
    points: 15,
    difficulte: 2,
    tags: ['histoire', 'fondation']
  },
  {
    rubrique: 'quiz',
    niveau: 'intermediaire',
    type: 'qcm',
    question: { 
      fr: "En quelle année a eu lieu l'exil vers Bangou ?",
      bandenkop: ""
    },
    options: ["1920-1930", "1900-1910", "1940-1950"],
    reponse: "1920-1930",
    points: 15,
    difficulte: 2,
    tags: ['histoire', 'exil']
  },
  
  // Quiz - Avancé
  {
    rubrique: 'quiz',
    niveau: 'avance',
    type: 'qcm',
    question: { 
      fr: "Que signifie le Khé dans la tradition ?",
      bandenkop: ""
    },
    options: ["La quête de vérité", "La danse guerrière", "Le mariage royal"],
    reponse: "La quête de vérité",
    points: 20,
    difficulte: 3,
    tags: ['tradition', 'justice']
  },
  
  // Prononciation
  {
    rubrique: 'prononciation',
    niveau: 'debutant',
    type: 'audio',
    question: { 
      fr: "Comment dit-on 'Bonjour' ?",
      bandenkop: "Mba'a le"
    },
    reponse: "Mba'a le",
    points: 5,
    difficulte: 1,
    audio: "/audio/bonjour.mp3"
  },
  {
    rubrique: 'prononciation',
    niveau: 'debutant',
    type: 'audio',
    question: { 
      fr: "Comment dit-on 'Merci' ?",
      bandenkop: "Mbo'a"
    },
    reponse: "Mbo'a",
    points: 5,
    difficulte: 1,
    audio: "/audio/merci.mp3"
  },
  {
    rubrique: 'prononciation',
    niveau: 'debutant',
    type: 'audio',
    question: { 
      fr: "Comment dit-on 'Chef' ?",
      bandenkop: "Fo'o"
    },
    reponse: "Fo'o",
    points: 5,
    difficulte: 1,
    audio: "/audio/chef.mp3"
  },
  {
    rubrique: 'prononciation',
    niveau: 'intermediaire',
    type: 'audio',
    question: { 
      fr: "Comment dit-on 'La paix soit avec toi' ?",
      bandenkop: "A nyu ngang"
    },
    reponse: "A nyu ngang",
    points: 10,
    difficulte: 2,
    audio: "/audio/paix.mp3"
  },
  
  // Association mot-image
  {
    rubrique: 'association',
    niveau: 'debutant',
    type: 'image',
    question: { 
      fr: "Associe l'image au mot",
      bandenkop: "Fo'o" 
    },
    image: "/images/chef.jpg",
    reponse: "chef",
    points: 10,
    difficulte: 1
  },
  {
    rubrique: 'association',
    niveau: 'debutant',
    type: 'image',
    question: { 
      fr: "Associe l'image au mot",
      bandenkop: "Nkul" 
    },
    image: "/images/tambour.jpg",
    reponse: "tambour",
    points: 10,
    difficulte: 1
  },
  {
    rubrique: 'association',
    niveau: 'debutant',
    type: 'image',
    question: { 
      fr: "Associe l'image au mot",
      bandenkop: "Khe" 
    },
    image: "/images/masque.jpg",
    reponse: "masque",
    points: 10,
    difficulte: 1
  },
  {
    rubrique: 'association',
    niveau: 'intermediaire',
    type: 'image',
    question: { 
      fr: "Associe l'image au mot",
      bandenkop: "Nda" 
    },
    image: "/images/case.jpg",
    reponse: "case",
    points: 15,
    difficulte: 2
  },
  
  // Écriture
  {
    rubrique: 'ecriture',
    niveau: 'debutant',
    type: 'texte',
    question: { 
      fr: "Écris 'Bonjour' en Bandenkop",
      bandenkop: "" 
    },
    reponse: "Mba'a le",
    points: 10,
    difficulte: 1
  },
  {
    rubrique: 'ecriture',
    niveau: 'debutant',
    type: 'texte',
    question: { 
      fr: "Écris 'Chef' en Bandenkop",
      bandenkop: "" 
    },
    reponse: "Fo'o",
    points: 10,
    difficulte: 1
  },
  
  // Phonétique
  {
    rubrique: 'phonetique',
    niveau: 'debutant',
    type: 'audio',
    question: { 
      fr: "Quel son entends-tu ?",
      bandenkop: "" 
    },
    options: ["[ŋ]", "[ɲ]", "[ⁿd]"],
    reponse: "[ŋ]",
    points: 10,
    difficulte: 1,
    audio: "/audio/son-ng.mp3"
  }
];

async function seed() {
  try {
    console.log('📦 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bandenkop');
    console.log('✅ Connecté à MongoDB');
    
    // Nettoyer la base
    console.log('🧹 Nettoyage des collections...');
    await Question.deleteMany({});
    await User.deleteMany({});
    console.log('✅ Collections nettoyées');
    
    // Ajouter les questions
    console.log(`📝 Ajout de ${questions.length} questions...`);
    const result = await Question.insertMany(questions);
    console.log(`✅ ${result.length} questions ajoutées`);
    
    // Créer un admin
    console.log('👑 Création de l\'administrateur...');
const hashedPassword = await bcrypt.hash('Zazalieuh!', 10);
await User.create({
  prenom: 'Admin',           // ← AJOUTÉ
  nom: 'Super',              // ← AJOUTÉ (optionnel mais recommandé)
  email: 'admin@bandenkop.com',
  password: hashedPassword,
  quartier: 'Denkeng',        // ← AJOUTÉ
  sexe: 'Homme',             // ← AJOUTÉ
  role: 'admin'
});
    console.log('✅ Admin créé (admin@bandenkop.com / Zazalieuh!)');
    
    console.log('\n✨ Base de données initialisée avec succès !');
    console.log('📊 Statistiques:');
    console.log(`   - Questions: ${result.length}`);
    console.log(`   - Utilisateur admin: admin@bandenkop.com`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    
    // Afficher plus de détails sur l'erreur
    if (error.errors) {
      console.error('\nDétails de la validation:');
      Object.keys(error.errors).forEach(key => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    
    process.exit(1);
  }
}

seed();