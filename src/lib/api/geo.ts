import type { ZoneDto } from '@/types/geo'

import { apiGet, anonymous } from '../api-client'

export const geoApi = {
  /**
   * Every serviceable zone. Public, and requested anonymously so the picker
   * works for a visitor who has not signed in yet.
   */
  listZones: () => apiGet<ZoneDto[]>('/zones', anonymous),
}
