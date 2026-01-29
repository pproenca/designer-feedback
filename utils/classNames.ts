/**
 * Conditional class name helper.
 * Joins truthy string values with spaces, filtering out falsy values.
 */
export type ClassValue = string | boolean | undefined | null | ClassValue[];

export function classNames(...classes: ClassValue[]): string {
  return classes
    .flat()
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .join(' ');
}
