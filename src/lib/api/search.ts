import { apiGet, apiGetPaginated } from '../api-client'
import type {
  GlobalSearchDto,
  RestaurantHitDto,
  FoodHitDto,
  CategoryHitDto,
  TrendingHitDto,
  PopularFoodHitDto,
  AutocompleteHitDto,
  SearchRestaurantsDto,
  SearchFoodDto,
  SearchCategoriesDto,
  NearbySearchDto,
  TrendingDto,
  PopularDto,
  AutocompleteDto,
} from '@/types/search'

export const searchApi = {
  globalSearch: (query?: { q?: string; limit?: number }) =>
    apiGet<GlobalSearchDto>('/search', { params: query }),

  searchRestaurants: (query?: SearchRestaurantsDto) =>
    apiGetPaginated<RestaurantHitDto>('/search/restaurants', { params: query }),

  searchFood: (query?: SearchFoodDto) =>
    apiGetPaginated<FoodHitDto>('/search/food', { params: query }),

  searchCategories: (query?: SearchCategoriesDto) =>
    apiGet<CategoryHitDto[]>('/search/categories', { params: query }),

  searchNearby: (query?: NearbySearchDto) =>
    apiGetPaginated<RestaurantHitDto>('/search/nearby', { params: query }),

  getTrending: (query?: TrendingDto) =>
    apiGetPaginated<TrendingHitDto>('/search/trending', { params: query }),

  getPopular: (query?: PopularDto) =>
    apiGetPaginated<PopularFoodHitDto>('/search/popular', { params: query }),

  autocomplete: (query: AutocompleteDto) =>
    apiGet<AutocompleteHitDto[]>('/search/autocomplete', { params: query }),
}
