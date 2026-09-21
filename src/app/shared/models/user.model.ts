export interface AuthUser {
  /** UID de Firebase. */
  id: string;
  name: string;
  email: string;
  /** Foto de perfil de la cuenta de Google, si la tiene. */
  photoUrl?: string;
  roles: string[];
}
