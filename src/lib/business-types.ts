// `lucide-react-native` rather than `lucide-react`: identical icon names,
// rendered through react-native-svg instead of DOM <svg>.
import {
  Cake,
  Coffee,
  CookingPot,
  CupSoda,
  IceCreamCone,
  type LucideIcon,
  Sandwich,
  ShoppingBasket,
  Soup,
  Store,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react-native";

import { BusinessType } from "@/types/enums";

interface BusinessTypeMeta {
  /** Singular, as it reads on a badge or in a picker. */
  label: string;
  /** Used for counts and headings — "12 bakeries near you". */
  plural: string;
  /** One line of help under the picker, so an owner knows which to choose. */
  hint: string;
  icon: LucideIcon;
}

/**
 * Every kind of business the platform lists, in the order they are offered.
 *
 * Ordered by how common each is rather than alphabetically: the first few
 * options cover most sign-ups, and a bakery owner should not have to read
 * through twelve entries to find themselves.
 */
export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeMeta> = {
  RESTAURANT: {
    label: "Restaurant",
    plural: "restaurants",
    hint: "A sit-down kitchen serving full meals.",
    icon: UtensilsCrossed,
  },
  FAST_FOOD: {
    label: "Fast food",
    plural: "fast food places",
    hint: "Burgers, pizza, fried chicken — made to order, quickly.",
    icon: Sandwich,
  },
  CAFE: {
    label: "Cafe",
    plural: "cafes",
    hint: "Chai, coffee and a short food menu.",
    icon: Coffee,
  },
  BAKERY: {
    label: "Bakery",
    plural: "bakeries",
    hint: "Bread, cakes and baked goods.",
    icon: Cake,
  },
  CAFETERIA: {
    label: "Cafeteria",
    plural: "cafeterias",
    hint: "A canteen serving a campus, hospital or office.",
    icon: Soup,
  },
  DHABA: {
    label: "Dhaba",
    plural: "dhabas",
    hint: "A roadside eatery.",
    icon: CookingPot,
  },
  SWEET_SHOP: {
    label: "Sweet shop",
    plural: "sweet shops",
    hint: "Mithai and traditional confectionery.",
    icon: Store,
  },
  JUICE_CORNER: {
    label: "Juice corner",
    plural: "juice corners",
    hint: "Juices, shakes and chai counters.",
    icon: CupSoda,
  },
  DESSERT_PARLOUR: {
    label: "Dessert parlour",
    plural: "dessert parlours",
    hint: "Ice cream, falooda and desserts.",
    icon: IceCreamCone,
  },
  HOME_KITCHEN: {
    label: "Home kitchen",
    plural: "home kitchens",
    hint: "Cooking from your own kitchen at home.",
    icon: CookingPot,
  },
  CLOUD_KITCHEN: {
    label: "Cloud kitchen",
    plural: "cloud kitchens",
    hint: "Delivery only — no dining room to walk into.",
    icon: Warehouse,
  },
  GROCERY: {
    label: "Grocery",
    plural: "grocery shops",
    hint: "Kiryana, mart and general provisions.",
    icon: ShoppingBasket,
  },
};

/** Picker and filter order. Keyed off the record so a new type cannot be missed. */
export const BUSINESS_TYPE_ORDER = Object.keys(BUSINESS_TYPES) as BusinessType[];

/**
 * The label for a type, tolerant of a value this build has not heard of — the
 * API can ship a new type before the frontend deploys, and an unrecognised one
 * should read as itself rather than blanking the badge.
 */
export function businessTypeLabel(type: BusinessType | null | undefined): string {
  if (type === null || type === undefined) {
    return BUSINESS_TYPES[BusinessType.RESTAURANT].label;
  }

  return BUSINESS_TYPES[type]?.label ?? titleCase(type);
}

export function businessTypeIcon(type: BusinessType | null | undefined): LucideIcon {
  if (type === null || type === undefined) {
    return BUSINESS_TYPES[BusinessType.RESTAURANT].icon;
  }

  return BUSINESS_TYPES[type]?.icon ?? Store;
}

/**
 * How to say "N places" for a filtered listing. Falls back to the neutral
 * "places" when the results are mixed, because "6 restaurants" is wrong the
 * moment a bakery is among them.
 */
export function businessTypeCountNoun(
  type: BusinessType | "" | null | undefined,
  count: number,
): string {
  if (type === null || type === undefined || type === "") {
    return count === 1 ? "place" : "places";
  }

  const meta = BUSINESS_TYPES[type];

  if (meta === undefined) {
    return count === 1 ? "place" : "places";
  }

  return count === 1 ? meta.label.toLowerCase() : meta.plural;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
