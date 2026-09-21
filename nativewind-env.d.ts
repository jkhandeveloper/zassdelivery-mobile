/// <reference types="nativewind/types" />

/**
 * `import "@/global.css"` in the root layout is how NativeWind's Metro
 * transformer is handed the stylesheet. TypeScript has no idea what a CSS
 * import resolves to, so without this the side-effect import is an error even
 * though the bundler handles it fine.
 */
declare module "*.css" {}
