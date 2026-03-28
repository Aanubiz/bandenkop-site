// src/utils/auth.js

// Stocker le token
export const setToken = (token) => {
  localStorage.setItem('token', token);
};

// Récupérer le token
export const getToken = () => {
  return localStorage.getItem('token');
};

// Supprimer le token (déconnexion)
export const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user'); // ← AJOUTE AUSSI
};

// Récupérer les infos de l'utilisateur depuis le token
export const getUser = () => {
  const token = getToken();
  if (!token) return null;
  
  try {
    // Décoder le payload du JWT
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.userId,
      role: payload.role,
      quartier: payload.quartier,
      ...payload
    };
  } catch (error) {
    console.error('Erreur décodage token:', error);
    return null;
  }
};

// Vérifier si l'utilisateur est connecté
export const isAuthenticated = () => {
  return !!getToken();
};

// Vérifier si l'utilisateur est admin
export const isAdmin = () => {
  const user = getUser();
  return user?.role === 'admin';
};

// Déconnexion
export const logout = () => {
  removeToken();
  window.location.href = '/';
};

// Récupérer le token pour les requêtes API
export const getAuthHeader = () => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// ===== NOUVELLES FONCTIONS AJOUTÉES =====

// Sauvegarder les infos utilisateur
export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Récupérer les infos utilisateur stockées
export const getStoredUser = () => {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};