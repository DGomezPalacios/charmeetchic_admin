import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  // devAuthBypass: true da una sesión de administrador simulada sin Firebase (solo desarrollo).
  mockFallback: true,
  devAuthBypass: false,
  // Proyecto Firebase "charme-et-chic" (Firebase Console → Project settings → General).
  // El projectId debe coincidir con `firebase.project-id` del backend.
  firebase: {
    apiKey: 'AIzaSyB1GdPjqZmXsbF3DgWbNkexjxknZMPwJyM',
    authDomain: 'charme-et-chic.firebaseapp.com',
    projectId: 'charme-et-chic',
    storageBucket: 'charme-et-chic.firebasestorage.app',
    messagingSenderId: '437207437791',
    appId: '1:437207437791:web:77bb697cab97d99ff9b46a',
  },
  adminRole: 'ADMIN',
  app: {
    name: 'Charme et Chic - Admin',
    logo: 'assets/logo.svg',
    locale: 'es-CL',
    currency: 'CLP',
  },
};
