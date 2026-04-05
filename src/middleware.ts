// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

// Date de lancement
const LAUNCH_DATE = new Date();
LAUNCH_DATE.setDate(LAUNCH_DATE.getDate() + 10);
LAUNCH_DATE.setHours(0, 0, 0, 0);

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url.pathname;
  
  const publicPaths = ['/maintenance', '/connexion', '/inscription', '/api/auth'];
  const isPublicPath = publicPaths.some(path => url.startsWith(path));
  const isStaticAsset = url.match(/\.(css|js|jpg|png|svg|ico|woff2?)$/);
  
  const token = context.cookies.get('token')?.value;
  let isAdmin = false;
  
  if (token) {
    try {
      const raw = decodeURIComponent(token);
      const base64Url = raw.split('.')[1] || '';
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
      isAdmin = payload.role === 'admin';
    } catch (e) {}
  }
  
  const now = new Date();
  const isMaintenance = now < LAUNCH_DATE;
  
  if (isMaintenance && !isAdmin && !isPublicPath && !isStaticAsset) {
    return context.redirect('/maintenance');
  }
  
  return next();
});