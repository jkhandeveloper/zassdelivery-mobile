import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional classes, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const PKR = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

/** Prices, always tabular — pair with the `numeric` class where digits stack. */
export function formatPrice(amount: number): string {
  return PKR.format(amount);
}

/**
 * True when a string is actually worth rendering.
 *
 * The API sends `null` for every empty optional string, so `!== undefined` is
 * not the test it looks like — it passes a null straight through to an <img
 * src> or a paragraph. Everything that renders an optional string goes
 * through here.
 */
export function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "";
}

/**
 * A landmark, without the doubled preposition.
 *
 * Seed and customer-entered landmarks often already start with "near", so
 * prefixing blindly produces "Near Near Pabbi Bus Stand".
 */
export function formatLandmark(landmark: string): string {
  return /^near\b/i.test(landmark.trim()) ? landmark.trim() : `Near ${landmark.trim()}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

const DATE = new Intl.DateTimeFormat("en-PK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit" });

/** An API timestamp as a date, or an em dash when it is null or unparseable. */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : DATE.format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : TIME.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  const date = formatDate(value);
  const time = formatTime(value);

  return time === "" ? date : `${date}, ${time}`;
}

/**
 * Whole seconds left until an ISO instant, floored at zero.
 *
 * Returned as a number rather than a string so a caller can also decide when
 * something has lapsed — an offer countdown and the "expired" state are the
 * same fact, and deriving them separately is how they end up disagreeing.
 */
export function secondsUntil(iso: string, from: number = Date.now()): number {
  const ms = new Date(iso).getTime() - from;

  return Number.isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / 1000));
}

/** "4:09" — a countdown, for a timer the user is watching run out. */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "just now", "6 min ago", "3 h ago", then a date once it stops being news. */
export function formatRelative(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;

  return formatDate(value);
}
