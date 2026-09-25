/**
 * The web app's design system, ported.
 *
 * The web app is on Tailwind 4 and declares its tokens in CSS with `@theme`.
 * NativeWind 4 is built on Tailwind 3, which has no `@theme`, so the same
 * tokens are declared as CSS custom properties in `src/global.css` and mapped
 * to utilities here. The *class names* therefore match the web app exactly —
 * `bg-surface`, `text-secondary`, `border-default`, `text-brand` — which is
 * what makes porting a screen a matter of copying its markup.
 *
 * Only the semantic layer is carried across. The raw brand hexes stay in
 * global.css, because a component referencing a raw hue instead of a semantic
 * surface is what breaks the dark theme.
 *
 * @type {import('tailwindcss').Config}
 */
const { platformSelect } = require("nativewind/theme");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Driven by a class, not the media query alone: a user who picks a theme
  // must beat their OS setting, same as on the web.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          sunken: "var(--surface-sunken)",
          inverse: "var(--surface-inverse)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          // `DEFAULT` generates `border-border`, but the screens (like the web
          // app) write `border-border-default`. Without this alias that class
          // matched nothing and Android drew every such border black.
          default: "var(--border-default)",
          strong: "var(--border-strong)",
        },

        // Text colours. `text-primary` / `text-secondary` read as text
        // utilities because that is how the web app uses them.
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        inverse: "var(--text-inverse)",

        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          contrast: "var(--brand-contrast)",
          soft: "var(--brand-soft)",
        },

        "accent-warm": {
          DEFAULT: "var(--secondary)",
          soft: "var(--secondary-soft)",
        },
        "accent-gold": {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
        "accent-violet": {
          DEFAULT: "var(--violet)",
          soft: "var(--violet-soft)",
        },

        success: {
          DEFAULT: "var(--state-success)",
          soft: "var(--state-success-soft)",
        },
        warning: {
          DEFAULT: "var(--state-warning)",
          soft: "var(--state-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--state-error)",
          soft: "var(--state-error-soft)",
        },

        skeleton: {
          DEFAULT: "var(--skeleton-base)",
          sheen: "var(--skeleton-sheen)",
        },
      },

      borderRadius: {
        input: "16px",
        card: "22px",
        panel: "28px",
        hero: "32px",
      },

      fontFamily: {
        // Embedded by the expo-font plugin in app.config.ts. Android registers
        // them as weighted XML families under the names below. iOS takes the
        // family from the font file ("Plus Jakarta Sans"), but a platformSelect
        // value containing spaces compiles to an *empty* rule in NativeWind, so
        // iOS gets the ExtraBold face by its PostScript name instead — display
        // type is always extra-bold anyway.
        display: platformSelect({
          ios: "PlusJakartaSans-ExtraBold",
          default: "PlusJakartaSans",
        }),
        sans: platformSelect({ ios: "Inter", default: "Inter" }),
      },
    },
  },
  plugins: [],
};
