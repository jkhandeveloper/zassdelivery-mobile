import { useQuery } from "@tanstack/react-query";

import { searchApi } from "@/lib/api/search";
import type { AutocompleteDto, PopularDto, TrendingDto } from "@/types/search";

export const searchKeys = {
  all: ["search"] as const,
  popular: (query: PopularDto) => [...searchKeys.all, "popular", query] as const,
  trending: (query: TrendingDto) => [...searchKeys.all, "trending", query] as const,
  autocomplete: (query: AutocompleteDto) => [...searchKeys.all, "autocomplete", query] as const,
};

/** The dishes people are actually ordering — the "Popular near you" rail. */
export function usePopularDishes(query?: PopularDto) {
  return useQuery({
    queryKey: searchKeys.popular(query ?? {}),
    queryFn: () => searchApi.getPopular(query),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingDishes(query?: TrendingDto) {
  return useQuery({
    queryKey: searchKeys.trending(query ?? {}),
    queryFn: () => searchApi.getTrending(query),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Header suggestions. Debouncing belongs to the caller — this only decides
 * whether a term is worth a round trip at all.
 */
export function useAutocomplete(term: string, limit = 8) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: searchKeys.autocomplete({ q: trimmed, limit }),
    queryFn: () => searchApi.autocomplete({ q: trimmed, limit }),
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
