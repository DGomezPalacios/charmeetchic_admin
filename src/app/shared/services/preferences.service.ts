import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

interface Preferences {
  theme: ThemeMode;
  pageSize: number;
}

const STORAGE_KEY = 'cce.admin.preferences';
const DEFAULTS: Preferences = { theme: 'light', pageSize: 10 };

/** Preferencias de interfaz del administrador, guardadas en localStorage. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly theme = signal<ThemeMode>(DEFAULTS.theme);
  readonly pageSize = signal<number>(DEFAULTS.pageSize);

  constructor() {
    const stored = this.load();
    this.theme.set(stored.theme);
    this.pageSize.set(stored.pageSize);

    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      this.save({ theme, pageSize: this.pageSize() });
    });
  }

  private load(): Preferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        return {
          theme: parsed.theme === 'dark' ? 'dark' : 'light',
          pageSize: [5, 10, 25, 50].includes(parsed.pageSize ?? 0)
            ? (parsed.pageSize as number)
            : DEFAULTS.pageSize,
        };
      }
    } catch {
      // localStorage no disponible o JSON corrupto: se usan los valores por defecto.
    }
    return { ...DEFAULTS };
  }

  private save(prefs: Preferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Sin persistencia (modo privado, cuota): la preferencia vale solo para esta sesión.
    }
  }
}
