---
title: Use @reference for CSS Module Integration
impact: MEDIUM-HIGH
impactDescription: eliminates duplicate CSS output in modules
tags: comp, reference, css-modules, react
---

## Use @reference for CSS Module Integration

When using `@apply` in CSS modules, use `@reference` to import theme variables without duplicating CSS output.

**Incorrect (duplicates styles):**

```css
/* button.module.css */
/* Imports entire stylesheet, duplicates in output */
@import "../styles/main.css";

.custom-button {
  @apply bg-brand-500 px-4 py-2 rounded;
}
```

**Correct (@reference for zero duplication):**

```css
/* button.module.css */
/* References variables without emitting styles */
@reference "../styles/main.css";

.custom-button {
  @apply bg-brand-500 px-4 py-2 rounded;
}
```

**Usage in React component:**

```tsx
import styles from './button.module.css'

export function Button({ children }: { children: React.ReactNode }) {
  return <button className={styles.button}>{children}</button>
}
```

**Benefits:**
- Access to theme variables and utilities
- Zero CSS duplication in output
- Works with CSS modules
- Proper cascade layer integration

Reference: [Tailwind CSS Functions and Directives](https://tailwindcss.com/docs/functions-and-directives)
