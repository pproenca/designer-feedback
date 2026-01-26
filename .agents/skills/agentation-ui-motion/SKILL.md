---
name: agentation-ui-motion
description: Create or polish UI with Agentation-like visual style and smooth CSS animations. Use when a user asks for Agentation-style UI, slick motion or micro-interactions, floating toolbars/popovers, dark minimal surfaces, or when translating UI feedback into refined animation/easing patterns.
---

# Agentation UI + Motion

## Overview
Create UI and micro-interactions inspired by Agentation: dark floating surfaces, crisp iconography, subtle shadows, and springy CSS-only motion. Prefer transform/opacity animations with short durations and overshoot easings.

## Workflow
1. Clarify scope: ask for target stack (React/Vue/vanilla), components (toolbar, popover, card, modal), and whether CSS-only motion is required.
2. Apply UI tokens: use `references/agentation-ui.md` for palette, surface, radius, and elevation defaults.
3. Apply motion tokens: use `references/agentation-motion.md` for easings, durations, and animation patterns.
4. Scaffold quickly: copy `assets/agentation-motion.css` into the project and adapt tokens to the app theme.
5. Ship with polish: ensure hover/active states, focus visibility, and reduced-motion fallbacks.

## Rules of Thumb
- Prefer CSS keyframes and transitions over JS animation libraries unless requested.
- Animate transform and opacity; avoid layout-affecting properties when possible.
- Use short, snappy timings with subtle overshoot; exit animations should be faster than enter.
- Keep UI compact and precise: tight spacing, clear hierarchy, small radii for tooltips, larger for panels.

## Resources
- `references/agentation-ui.md`: palette, surface, radius, typography, elevation, and component styling cues.
- `references/agentation-motion.md`: easing curves, duration bands, motion patterns, and micro-interactions.
- `assets/agentation-motion.css`: drop-in CSS variables + keyframes.
- `scripts/apply_agentation_motion.py`: helper to print or write the CSS asset.
