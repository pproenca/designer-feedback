# Agentation Motion Reference

## Motion principles
- Use transform and opacity for motion; avoid animating layout when possible.
- Enter animations feel slightly springy; exits are quicker and cleaner.
- Combine scale + translate for depth; keep moves under 10px.
- Prefer CSS keyframes and transitions unless a library is required.

## Easing curves
- Smooth container motion: cubic-bezier(0.19, 1, 0.22, 1)
- Springy pop: cubic-bezier(0.34, 1.2, 0.64, 1)
- Bouncy micro-pop: cubic-bezier(0.34, 1.56, 0.64, 1)
- Accordion/chevron: cubic-bezier(0.16, 1, 0.3, 1)
- Marker pop: cubic-bezier(0.22, 1, 0.36, 1)

## Duration bands
- Micro: 0.1s to 0.15s (hover, tooltip fade)
- UI: 0.2s (toggle, text cycle, small transitions)
- Enter: 0.25s to 0.5s (toolbar, popover)
- Soft/blur: 0.6s to 0.8s (content blur/scale)

## Pattern recipes
- Scale in: opacity 0 -> 1, scale 0.85 -> 1 (0.15s to 0.3s, ease-out).
- Slide up: scale 0.85 -> 1 + translateY 8px -> 0 (0.2s to 0.3s).
- Toolbar enter: scale 0.5 -> 1 + rotate 90deg -> 0deg + fade (0.5s, springy).
- Tooltip: scale 0.95 -> 1, fade in, 0.135s; optional ~0.85s delay before showing.
- Panel: translateY 10px -> 0, scale 0.95 -> 1, blur 5px -> 0.
- Marker: scale 0.3 -> 1 using cubic-bezier(0.22, 1, 0.36, 1).
- Exit: reverse motion with shorter duration (0.15s to 0.2s).

## Accordion height
- Use grid-template-rows: 0fr -> 1fr with overflow hidden.
- Pair with 0.3s cubic-bezier(0.16, 1, 0.3, 1).

## Accessibility and performance
- Add will-change: transform, opacity on animated layers.
- Respect prefers-reduced-motion by disabling keyframes or shortening durations.
