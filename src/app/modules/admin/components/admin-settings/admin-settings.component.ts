import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../../shared/services/auth.service';
import { PAGE_SIZE_OPTIONS } from '../../../../shared/constants';
import { PreferencesService, ThemeMode } from '../../../../shared/services/preferences.service';

/** Se ingresa con Google: contraseña y seguridad de la cuenta se gestionan allí, no en este panel. */
const PASSWORD_CHANGE_URL = 'https://myaccount.google.com/security';

@Component({
  selector: 'app-admin-settings',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
})
export class AdminSettingsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly preferences = inject(PreferencesService);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly passwordUrl = PASSWORD_CHANGE_URL;

  protected setTheme(theme: ThemeMode): void {
    this.preferences.theme.set(theme);
  }

  protected setPageSize(size: number): void {
    this.preferences.pageSize.set(size);
  }
}
