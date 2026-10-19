import { apiDelete, apiGet, apiPatch, apiPost } from '../api-client'
import type {
  CartDto,
  EmptyCartDto,
  AddCartItemDto,
  UpdateCartItemDto,
  ApplyCouponDto,
  SetCartAddressDto,
  SetTipDto,
  CartRiderOptionDto,
  SetCartRiderDto,
  SetFulfilmentDto,
} from '@/types/cart'

type Cart = CartDto | EmptyCartDto

export const cartApi = {
  getCart: () => apiGet<Cart>('/cart'),

  addItem: (data: AddCartItemDto) => apiPost<Cart>('/cart/items', data),

  updateItem: (itemId: string, data: UpdateCartItemDto) =>
    apiPatch<Cart>(`/cart/items/${itemId}`, data),

  removeItem: (itemId: string) => apiDelete<Cart>(`/cart/items/${itemId}`),

  clearCart: () => apiDelete<Cart>('/cart'),

  applyCoupon: (data: ApplyCouponDto) => apiPost<Cart>('/cart/coupon', data),

  removeCoupon: () => apiDelete<Cart>('/cart/coupon'),

  setDeliveryAddress: (data: SetCartAddressDto) => apiPatch<Cart>('/cart/address', data),

  setTip: (data: SetTipDto) => apiPatch<Cart>('/cart/tip', data),

  setFulfilment: (data: SetFulfilmentDto) => apiPatch<Cart>('/cart/fulfilment', data),

  getRiders: () => apiGet<CartRiderOptionDto[]>('/cart/riders'),

  setRider: (data: SetCartRiderDto) => apiPatch<Cart>('/cart/rider', data),

  validateCart: () => apiPost<Cart>('/cart/validate', {}),
}
