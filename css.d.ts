// Global CSS imports (side-effect imports)
declare module "*/globals.css" {
  const content: never;
  export default content;
}

// Regular CSS module imports
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.sass" {
  const content: Record<string, string>;
  export default content;
}
