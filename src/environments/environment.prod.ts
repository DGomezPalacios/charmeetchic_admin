import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://vigilant-xylophone-g45r4wg64g9v397r9-8000.app.github.dev/api',
  mockFallback: false,
  devAuthBypass: false,
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
