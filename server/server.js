import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './database.js';
import authRoutes from './api/auth.js';
import quizRoutes from './api/quiz.js';
import progressionRoutes from './api/progression.js';
import adminRoutes from './api/admin.js';
import classementRoutes from './api/classement.js';
import articlesRoutes from './api/articles.js';
import adminQuizRoutes from './api/admin/quiz.js';
import adminPrononciationRoutes from './api/admin/prononciation.js';
import adminEcritureRoutes from './api/admin/ecriture.js';
import adminPhonetiqueRoutes from './api/admin/phonetique.js';
import adminAssociationRoutes from './api/admin/association.js';
import prononciationRoutes from './api/prononciation.js';
import figuresRoutes from './api/figures.js'; 
import uploadRoutes from './api/upload.js';
import cultureRoutes from './api/culture.js';


import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Autoriser les requêtes sans Origin (curl, Postman, apps natives)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqué pour l'origine: ${origin}`));
  },
  credentials: true
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion à MongoDB
connectDB();

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progression', progressionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/classement', classementRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/admin/quiz', adminQuizRoutes);
app.use('/api/admin/prononciation', adminPrononciationRoutes);
app.use('/api/admin/ecriture', adminEcritureRoutes);
app.use('/api/admin/phonetique', adminPhonetiqueRoutes);
app.use('/api/admin/association', adminAssociationRoutes);
app.use('/api/prononciation', prononciationRoutes);
app.use('/api/figures', figuresRoutes); 
app.use('/api/upload', uploadRoutes);
app.use('/api/culture', cultureRoutes);



// Servir les fichiers statiques en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api`);
  console.log(`💬 Chat Socket.io prêt`);
});