import { PaymentMethod, PaymentQrProvider } from "@/types/enums";
import type { PaymentQrCodeDto } from "@/types/payment";

/** The API sends the enum member; these are what a customer or a cook calls them. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH_ON_DELIVERY]: "Cash on delivery",
  [PaymentMethod.WALLET]: "Wallet",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.JAZZCASH]: "JazzCash",
  [PaymentMethod.EASYPAISA]: "Easypaisa",
  [PaymentMethod.BANK_TRANSFER]: "Bank transfer",
  [PaymentMethod.QR_TRANSFER]: "Scan & pay",
};

export const QR_PROVIDER_LABELS: Record<PaymentQrProvider, string> = {
  [PaymentQrProvider.JAZZCASH]: "JazzCash",
  [PaymentQrProvider.EASYPAISA]: "Easypaisa",
  [PaymentQrProvider.BANK]: "Bank / Raast",
  [PaymentQrProvider.OTHER]: "Other wallet",
};

/** The order providers are offered in: the two wallets most customers carry first. */
export const QR_PROVIDER_ORDER: readonly PaymentQrProvider[] = [
  PaymentQrProvider.JAZZCASH,
  PaymentQrProvider.EASYPAISA,
  PaymentQrProvider.BANK,
  PaymentQrProvider.OTHER,
];

/** Must match `MAX_PAYMENT_QR_CODES` on the API. */
export const MAX_PAYMENT_QR_CODES = 6;

/** A code's own label when it has one ("Meezan Bank"), otherwise its provider. */
export function qrCodeName(code: Pick<PaymentQrCodeDto, "provider" | "label">): string {
  return code.label !== null && code.label !== "" ? code.label : QR_PROVIDER_LABELS[code.provider];
}
