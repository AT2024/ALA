/**
 * Utility functions for the frontend
 */

/**
 * Combines class names, filtering out falsy values.
 * Similar to clsx/classnames but without the dependency.
 */
export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
