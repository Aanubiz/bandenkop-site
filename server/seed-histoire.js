import mongoose from 'mongoose';
import ArticleHistoire from './models/ArticleHistoire.js';
import dotenv from 'dotenv';

dotenv.config();

const articles = [
  {
    titre: "Origines de Bandenkop",
    slug: "origines",
    periode: "1700-1750",
    auteur: "Comité d'histoire de Bandenkop",
    contenu: `<p>Les origines de Bandenkop remontent au XVIIIe siècle...</p>
              <blockquote>"Nos ancêtres ont choisi cette terre..."<cite>— Parole des anciens</cite></blockquote>`,
    imageCouverture: "/images/histoire/origines.jpg",
    tags: ["origines", "histoire", "tradition"]
  },
  // ... tous les autres articles
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await ArticleHistoire.deleteMany({});
  await ArticleHistoire.insertMany(articles);
  console.log('✅ Articles importés');
  process.exit();
}

seed();