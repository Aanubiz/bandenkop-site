import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout après 5s
    });
    
    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
    console.log(`📦 Base de données: ${conn.connection.name}`);
    
    // Créer les index pour les performances
    await createIndexes(conn);
    
    return conn;
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

async function createIndexes(conn) {
  const db = conn.connection.db;
  
  // Index pour les questions (recherches rapides)
  await db.collection('questions').createIndex({ rubrique: 1, niveau: 1 });
  await db.collection('questions').createIndex({ dateDerniereUtilisation: 1 });
  
  // Index pour les progressions utilisateur
  await db.collection('progressions').createIndex({ userId: 1, rubrique: 1 }, { unique: true });
  
  console.log('✅ Index créés avec succès');
}