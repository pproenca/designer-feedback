# Agentation UI Style Reference

## Intent
- Build compact, floating UI with dark surfaces, crisp contrast, and subtle depth.
- Keep controls small, precise, and visually weighty without heavy borders.

## Palette (defaults)
- Background: #1a1a1a
- Surface hover: #2a2a2a
- Surface active: #383838
- Text: #ffffff
- Muted text: rgba(255,255,255,0.5) to rgba(255,255,255,0.85)
- Border: rgba(255,255,255,0.08)
- Primary: #3c82f7
- Success: #34c759
- Danger: #ff3b30
- Light surface: #ffffff
- Light surface subtle: #f5f5f5
- Light text: rgba(0,0,0,0.85)

## Elevation
- Small: 0 2px 8px rgba(0,0,0,0.2)
- Medium: 0 4px 16px rgba(0,0,0,0.1)
- Popover: 0 4px 24px rgba(0,0,0,0.3) + 1px border rgba(255,255,255,0.08)

## Shape + sizing
- Floating pill toolbar: 44px height, 22px radius.
- Popovers/panels: 16px radius.
- Tooltips: 8px radius.
- Circular buttons: 34px size, 50% radius.
- Badges: 18px height, 9px radius, small padding.

## Typography + iconography
- Font: system UI stack; use 12-14px labels, 10-12px metadata.
- Weight: 500-600 for labels, 400 for metadata.
- Icons: 1.5px stroke; center-align paths; keep glyphs minimal.

## Component cues
- Tooltip arrow: rotated square with slight rounding.
- Badge: saturated accent with a subtle shadow and scale-in animation.
- Focus: visible outline using primary color; keep contrast high.
- Pointer events: disable on outer overlay, enable on inner controls.

## Layout habits
- Use fixed positioning for floating controls.
- Keep z-index high (>=100000) for overlays.
- Use tight gaps (6-10px) between controls.
