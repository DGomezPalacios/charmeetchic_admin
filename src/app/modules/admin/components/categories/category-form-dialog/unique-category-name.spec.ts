import { FormControl } from '@angular/forms';
import { uniqueCategoryName } from './category-form-dialog.component';

describe('uniqueCategoryName', () => {
  const existing = [
    { id: 1, name: 'Collares', description: '' },
    { id: 2, name: 'Aretes', description: '' },
  ];

  it('rechaza un nombre repetido sin distinguir mayúsculas ni espacios', () => {
    expect(uniqueCategoryName(existing)(new FormControl('  collares '))).toEqual({
      duplicate: true,
    });
  });

  it('acepta un nombre nuevo o vacío (lo valida "required")', () => {
    expect(uniqueCategoryName(existing)(new FormControl('Relojes'))).toBeNull();
    expect(uniqueCategoryName(existing)(new FormControl(''))).toBeNull();
  });

  it('al editar, permite conservar el propio nombre', () => {
    expect(uniqueCategoryName(existing, 1)(new FormControl('Collares'))).toBeNull();
    expect(uniqueCategoryName(existing, 1)(new FormControl('Aretes'))).toEqual({ duplicate: true });
  });
});
