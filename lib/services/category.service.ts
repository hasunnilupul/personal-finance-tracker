import { categoryRepository } from "@/lib/repositories/category.repository";
import { Category, NewCategory } from "@/lib/db/models/category.model";

export class CategoryService {
  async getAllCategories(userId: string): Promise<Category[]> {
    return categoryRepository.findAll(userId);
  }

  async getCategoryById(id: number, userId: string): Promise<Category | undefined> {
    return categoryRepository.findById(id, userId);
  }

  async createCategory(data: NewCategory): Promise<Category> {
    return categoryRepository.create(data);
  }

  async updateCategory(
    id: number,
    userId: string,
    data: Partial<NewCategory>,
  ): Promise<Category | undefined> {
    return categoryRepository.update(id, userId, data);
  }

  async deleteCategory(id: number, userId: string): Promise<boolean> {
    return categoryRepository.delete(id, userId);
  }
}

export const categoryService = new CategoryService();
