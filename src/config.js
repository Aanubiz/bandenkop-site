// src/config.js
export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const { origin, hostname, protocol } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    // ✅ CORRECTION : L'API écoute sur 3002 selon ton .env
    if (isLocal) {
      return `${protocol}//${hostname}:3002`;
    }

    // En prod, utiliser la même origine (le reverse proxy redirigera /api vers 3002)
    return origin;
  }

  // ✅ CORRECTION : Fallback sur 3002
  return 'http://localhost:3002';
};