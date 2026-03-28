import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bandenkop');
    
    const admin = await User.findOne({ email: 'admin@bandenkop.com' });
    
    if (!admin) {
      console.log('❌ Admin non trouvé');
      process.exit(1);
    }
    
    console.log('✅ Admin trouvé');
    console.log('Hash stocké:', admin.password);
    
    // Liste des mots de passe à tester
    const passwordsToTest = [
      'Zazalieuh!',
      'Zazalieuh',        // sans !
      'zazalieuh!',       // minuscules
      'admin123',
      'Admin123!',
      'password'
    ];
    
    for (const pwd of passwordsToTest) {
      const isValid = await bcrypt.compare(pwd, admin.password);
      console.log(`🔑 "${pwd}" → ${isValid ? '✅ CORRECT' : '❌ incorrect'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testPassword();