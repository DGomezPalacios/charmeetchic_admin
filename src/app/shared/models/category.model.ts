export interface Category {
  id: number;
  name: string;
  description: string;
  createdAt?: Date;
}

export type CategoryDTO = Pick<Category, 'name' | 'description'>;
