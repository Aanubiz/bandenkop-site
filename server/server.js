import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. ON CHARGE LE ENV EN TOUT PREMIER
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 2. ON IMPORTE LE RESTE DYNAMIQUEMENT APRÈS
const { default: express } = await import('express');
const { default: http } = await import('http');
const { Server } = await import('socket.io');
const { default: cors } = await import('cors');
const { connectDB } = await import('./database.js');

// On importe les routes seulement APRES que dotenv soit prêt
const { default: authRoutes } = await import('./api/auth.js');
const { default: quizRoutes } = await import('./api/quiz.js');
const { default: progressionRoutes } = await import('./api/progression.js');
const { default: adminRoutes } = await import('./api/admin.js');
const { default: adminQuizRoutes } = await import('./api/admin/quiz.js');
const { default: adminAssociationRoutes } = await import('./api/admin/association.js');
const { default: adminAssociationImageRoutes } = await import('./api/admin/association-image.js');
const { default: adminPronunciationRoutes } = await import('./api/admin/prononciation.js');
const { default: adminPhonetiqueRoutes } = await import('./api/admin/phonetique.js');
const { default: adminEcritureRoutes } = await import('./api/admin/ecriture.js');
const { default: classementRoutes } = await import('./api/classement.js');
const { default: articlesRoutes } = await import('./api/articles.js');
const { default: prononciationRoutes } = await import('./api/prononciation.js');
const { default: figuresRoutes } = await import('./api/figures.js');
const { default: uploadRoutes } = await import('./api/upload.js');
const { default: notifyRoutes } = await import('./api/notify.js');
const { default: contactRoutes } = await import('./api/contact.js');
const { default: ecritureRoutes } = await import('./api/ecriture.js');
const { default: associationRoutes } = await import('./api/association.js');
const { default: associationImageRoutes } = await import('./api/association-image.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://bandenkoponline.com', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware CORS pour production
app.use(cors({
  origin: ['https://bandenkoponline.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés via /api/uploads/
// En production, Nginx proxie /api/ vers Express, donc /api/uploads/ fonctionne
// sans avoir à modifier la config Nginx
app.use('/api/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Connexion à MongoDB
connectDB();

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progression', progressionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/quiz', adminQuizRoutes);
app.use('/api/admin/association', adminAssociationRoutes);
app.use('/api/admin/association-image', adminAssociationImageRoutes);
app.use('/api/admin/prononciation', adminPronunciationRoutes);
app.use('/api/admin/phonetique', adminPhonetiqueRoutes);
app.use('/api/admin/ecriture', adminEcritureRoutes);
app.use('/api/classement', classementRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/prononciation', prononciationRoutes);
app.use('/api/figures', figuresRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notify', notifyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ecriture', ecritureRoutes);
app.use('/api/association', associationRoutes);
app.use('/api/association-image', associationImageRoutes);

// Socket.io (chat)
io.on('connection', (socket) => {
  console.log('Nouvel utilisateur connecté au chat:', socket.id);
  socket.on('message', (data) => {
    io.emit('message', { ...data, timestamp: new Date().toISOString() });
  });
  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

// ⚠️ NE PAS servir les fichiers statiques ici
// En production, Nginx/Openresty s'occupe du frontend Astro SSR
// Le backend Express API écoute UNIQUEMENT sur /api/*

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api`);
  console.log(`🌐 Site accessible sur https://bandenkoponline.com`);
});