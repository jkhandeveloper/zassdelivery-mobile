/**
 * Search results, mirroring `search-response.dto.ts` on the backend.
 *
 * Verified against the live responses rather than transcribed from prose: a
 * dish hit carries `effectivePrice` (not `price`), its own id is the menu item
 * id, and every hit that can be navigated to carries the restaurant's slug —
 * which is what the storefront routes are keyed by.
 */

import type { BusinessType } from './enums'

export interface GlobalSearchDto {
  restaurants: RestaurantHitDto[]
  dishes: FoodHitDto[]
  categories: CategoryHitDto[]
  /** Total matches across all three groups. */
  totalResults: number
}

export interface RestaurantHitDto {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  coverUrl: string | null
  description: string | null
  rating: number
  ratingCount: number
  businessType: BusinessType
  priceRange: string
  minOrderAmount: number
  avgPreparationMinutes: number
  cityName: string
  zoneName: string
  /** Category names, already flattened. */
  categories: string[]
  isAcceptingOrders: boolean
  /** Metres from the supplied coordinates; null when none were given. */
  distanceMeters: number | null
  /** Full-text rank. Zero when the request carried no search term. */
  relevance: number
}

export interface FoodHitDto {
  /** The menu item's id — what /cart/items expects. */
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  basePrice: number
  discountedPrice: number | null
  /** What the customer pays: the discount when there is one, else basePrice. */
  effectivePrice: number
  isVegetarian: boolean
  spiceLevel: string
  rating: number
  ratingCount: number
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  restaurantRating: number
  distanceMeters: number | null
  relevance: number
}

export interface CategoryHitDto {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  /** Active restaurants in this category. */
  restaurantCount: number
}

/** Trending is restaurants, not dishes — the shape differs from a food hit. */
export interface TrendingHitDto {
  restaurantId: string
  name: string
  slug: string
  logoUrl: string | null
  rating: number
  /** Delivered orders inside the window. */
  recentOrders: number
}

export interface PopularFoodHitDto {
  id: string
  name: string
  imageUrl: string | null
  effectivePrice: number
  rating: number
  ratingCount: number
  restaurantName: string
  restaurantSlug: string
  /** Lifetime order lines for this dish. */
  orderCount: number
}

export interface AutocompleteHitDto {
  type: 'restaurant' | 'dish' | 'category'
  id: string
  label: string
  /** Where to navigate. For a dish this is its restaurant's slug. */
  slug: string
  imageUrl: string | null
  /** Trigram similarity, 0–1. A prefix match scores 1. */
  score: number
}

export interface SearchRestaurantsDto {
  q?: string
  page?: number
  limit?: number
  sortBy?: 'relevance' | 'rating' | 'distance' | 'preparation'
  sortOrder?: 'asc' | 'desc'
  cityId?: string
  zoneId?: string
  category?: string
  businessType?: BusinessType
  priceRange?: string
  minRating?: number
  openNow?: boolean
  latitude?: number
  longitude?: number
  radiusMeters?: number
}

export interface SearchFoodDto {
  q?: string
  page?: number
  limit?: number
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating'
  sortOrder?: 'asc' | 'desc'
  restaurantId?: string
  category?: string
  isVegetarian?: boolean
  minPrice?: number
  maxPrice?: number
  latitude?: number
  longitude?: number
  radiusMeters?: number
}

export interface SearchCategoriesDto {
  q?: string
  limit?: number
}

export interface NearbySearchDto {
  latitude: number
  longitude: number
  radiusMeters?: number
  limit?: number
  page?: number
}

export interface TrendingDto {
  days?: number
  limit?: number
  cityId?: string
  page?: number
}

export interface PopularDto {
  limit?: number
  cityId?: string
  page?: number
}

export interface AutocompleteDto {
  q: string
  limit?: number
}
