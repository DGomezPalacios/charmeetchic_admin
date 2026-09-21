import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Mensaje en español para el primer error de un control (o cadena vacía si es válido). */
export function getErrorMessage(
  control: AbstractControl | null,
  custom: Record<string, string> = {},
): string {
  const errors: ValidationErrors | null = control?.errors ?? null;
  if (!errors) {
    return '';
  }
  const key = Object.keys(errors)[0];
  if (custom[key]) {
    return custom[key];
  }
  const detail = errors[key] as Record<string, number> | boolean;
  switch (key) {
    case 'required':
      return 'Este campo es obligatorio.';
    case 'min':
      return `El valor mínimo es ${(detail as Record<string, number>)['min']}.`;
    case 'max':
      return `El valor máximo es ${(detail as Record<string, number>)['max']}.`;
    case 'minlength':
      return `Debe tener al menos ${(detail as Record<string, number>)['requiredLength']} caracteres.`;
    case 'maxlength':
      return `No puede superar los ${(detail as Record<string, number>)['requiredLength']} caracteres.`;
    case 'pattern':
      return 'El formato no es válido.';
    default:
      return 'El valor no es válido.';
  }
}
