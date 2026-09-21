import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost, apiPut } from '../api-client'
import type {
  MenuDto,
  MenuCategoryDto,
  MenuItemDto,
  MenuItemAdminDto,
  MenuVariantDto,
  AddOnGroupDto,
  AddOnDto,
  MenuItemImageDto,
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  AddMenuItemImageDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateAddOnGroupDto,
  UpdateAddOnGroupDto,
  CreateAddOnDto,
  UpdateAddOnDto,
  AdjustStockDto,
  BulkUpdateItemsDto,
  BulkStatusDto,
  BulkResultDto,
  ListMenuItemsQueryDto,
  ListMenuItemsAdminQueryDto,
  ListMenusQueryDto,
} from '@/types/menu'

export const menuApi = {
  // Public
  getRestaurantMenus: (restaurantId: string, query?: ListMenusQueryDto) =>
    apiGetPaginated<MenuDto>(`/restaurants/${restaurantId}/menu`, { params: query }),

  getMenuItems: (restaurantId: string, query?: ListMenuItemsQueryDto) =>
    apiGetPaginated<MenuItemDto>(`/restaurants/${restaurantId}/menu-items`, { params: query }),

  getMenuItem: (id: string) => apiGet<MenuItemDto>(`/menu-items/${id}`),

  getMenuItemImages: (id: string) =>
    apiGet<MenuItemImageDto[]>(`/menu-items/${id}/images`),

  // Management
  getRestaurantMenusAdmin: (restaurantId: string, query?: ListMenusQueryDto) =>
    apiGetPaginated<MenuDto>(`/menu-management/restaurants/${restaurantId}/menus`, { params: query }),

  createMenu: (restaurantId: string, data: CreateMenuDto) =>
    apiPost<MenuDto>(`/menu-management/restaurants/${restaurantId}/menus`, data),

  updateMenu: (menuId: string, data: UpdateMenuDto) =>
    apiPatch<MenuDto>(`/menu-management/menus/${menuId}`, data),

  deleteMenu: (menuId: string) =>
    apiDelete(`/menu-management/menus/${menuId}`),

  createMenuCategory: (menuId: string, data: CreateMenuCategoryDto) =>
    apiPost<MenuCategoryDto>(`/menu-management/menus/${menuId}/categories`, data),

  reorderMenuCategories: (menuId: string, data: { ids: string[] }) =>
    apiPut<MenuCategoryDto[]>(`/menu-management/menus/${menuId}/categories/order`, data),

  updateMenuCategory: (categoryId: string, data: UpdateMenuCategoryDto) =>
    apiPatch<MenuCategoryDto>(`/menu-management/categories/${categoryId}`, data),

  deleteMenuCategory: (categoryId: string) =>
    apiDelete(`/menu-management/categories/${categoryId}`),

  getRestaurantItemsAdmin: (restaurantId: string, query?: ListMenuItemsAdminQueryDto) =>
    apiGetPaginated<MenuItemAdminDto>(`/menu-management/restaurants/${restaurantId}/items`, { params: query }),

  createMenuItem: (data: CreateMenuItemDto) =>
    apiPost<MenuItemAdminDto>('/menu-management/items', data),

  updateMenuItem: (itemId: string, data: UpdateMenuItemDto) =>
    apiPatch<MenuItemAdminDto>(`/menu-management/items/${itemId}`, data),

  deleteMenuItem: (itemId: string) =>
    apiDelete(`/menu-management/items/${itemId}`),

  addMenuItemImage: (itemId: string, data: AddMenuItemImageDto) =>
    apiPost<MenuItemImageDto>(`/menu-management/items/${itemId}/images`, data),

  deleteMenuItemImage: (itemId: string, imageId: string) =>
    apiDelete(`/menu-management/items/${itemId}/images/${imageId}`),

  createVariant: (itemId: string, data: CreateVariantDto) =>
    apiPost<MenuVariantDto>(`/menu-management/items/${itemId}/variants`, data),

  updateVariant: (itemId: string, variantId: string, data: UpdateVariantDto) =>
    apiPatch<MenuVariantDto>(`/menu-management/items/${itemId}/variants/${variantId}`, data),

  deleteVariant: (itemId: string, variantId: string) =>
    apiDelete(`/menu-management/items/${itemId}/variants/${variantId}`),

  createAddOnGroup: (itemId: string, data: CreateAddOnGroupDto) =>
    apiPost<AddOnGroupDto>(`/menu-management/items/${itemId}/option-groups`, data),

  updateAddOnGroup: (itemId: string, groupId: string, data: UpdateAddOnGroupDto) =>
    apiPatch<AddOnGroupDto>(`/menu-management/items/${itemId}/option-groups/${groupId}`, data),

  deleteAddOnGroup: (itemId: string, groupId: string) =>
    apiDelete(`/menu-management/items/${itemId}/option-groups/${groupId}`),

  createAddOn: (itemId: string, groupId: string, data: CreateAddOnDto) =>
    apiPost<AddOnDto>(`/menu-management/items/${itemId}/option-groups/${groupId}/options`, data),

  updateAddOn: (itemId: string, optionId: string, data: UpdateAddOnDto) =>
    apiPatch<AddOnDto>(`/menu-management/items/${itemId}/options/${optionId}`, data),

  deleteAddOn: (itemId: string, optionId: string) =>
    apiDelete(`/menu-management/items/${itemId}/options/${optionId}`),

  adjustStock: (itemId: string, data: AdjustStockDto) =>
    apiPost<MenuItemAdminDto>(`/menu-management/items/${itemId}/stock`, data),

  bulkUpdateItems: (restaurantId: string, data: BulkUpdateItemsDto) =>
    apiPatch<BulkResultDto>(`/menu-management/restaurants/${restaurantId}/items/bulk`, data),

  bulkUpdateStatus: (restaurantId: string, data: BulkStatusDto) =>
    apiPatch<BulkResultDto>(`/menu-management/restaurants/${restaurantId}/items/bulk-status`, data),
}
