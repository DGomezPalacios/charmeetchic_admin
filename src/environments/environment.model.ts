/** Configuración web de Firebase (Firebase Console → Project settings → General → Your apps). */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface Environment {
  production: boolean;
  apiUrl: string;
  /** Si el backend no responde (status 0), usa datos de ejemplo en memoria. */
  mockFallback: boolean;
  /** Sesión de administrador simulada, sin Firebase. Ignorada cuando `production` es true. */
  devAuthBypass: boolean;
  firebase: FirebaseConfig;
  /**
   * URL del emulador de Firebase Auth (p. ej. `http://127.0.0.1:9099`) para desarrollar sin un proyecto
   * real. No debe definirse en producción.
   */
  authEmulatorUrl?: string;
  /** Rol (custom claim de Firebase, validado por el backend) que identifica a un administrador. */
  adminRole: string;
  app: {
    name: string;
    logo: string;
    locale: string;
    currency: string;
  };
}
