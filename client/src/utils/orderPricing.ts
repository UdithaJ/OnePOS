import type { Category } from '@/services/categoryApiService'

/** Matches server: max(weight × pricePerKg, minPrice). */
export function lineTotalForCategory(category: Category, weightKg: number): number {
  const w = Number(weightKg)
  if (Number.isNaN(w) || w < 0) return 0
  return Math.max(w * category.pricePerKg, category.minPrice)
}
