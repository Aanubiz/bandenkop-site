import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bandenkop');
    
    // Le nouveau mot de passe que tu veux
    const newPassword = 'Admin123!'; // Change ici si tu veux autre chose
    
    // Générer le hash
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour l'admin
    const result = await User.updateOne(
      { email: 'admin@bandenkop.com' },
      { $set: { password: hashedPassword } }
    );
    
    if (result.matchedCount === 0) {
      console.log('❌ Admin non trouvé avec cet email');
      process.exit(1);
    }
    
    console.log('✅ Mot de passe réinitialisé avec succès !');
    console.log('📧 Email: admin@bandenkop.com');
    console.log('🔑 Nouveau mot de passe:', newPassword);
    console.log('🔐 Nouveau hash:', hashedPassword);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

resetAdminPassword();