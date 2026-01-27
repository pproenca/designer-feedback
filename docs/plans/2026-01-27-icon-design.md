# Chrome Extension Icon Design

## Overview

Create a new icon for the Designer Feedback Chrome extension using Lucide React's `MessageCirclePlus` icon, rendered via a script to generate PNG files at required sizes.

## Visual Design

**Concept**: White speech bubble with plus sign on a blue rounded-square background.

**Specifications**:
- Background: `#3C82F7` (primary blue, matches badge/accent color)
- Background shape: Rounded square with 12px corner radius
- Icon: `MessageCirclePlus` from Lucide React
- Icon color: `#FFFFFF` (white)
- Icon stroke width: 1.5 (matches existing Icons.tsx style)

**Dimensions** (per Chrome Web Store guidelines):
- Total image: 128x128px
- Artwork area: 96x96px centered
- Transparent padding: 16px on each side

**Output sizes**: 16, 32, 48, 128px PNGs

## Technical Implementation

### Dependencies

```bash
npm install lucide-react
npm install -D sharp puppeteer @types/puppeteer
```

### Files to Create

1. `scripts/generate-icons.tsx` - React component for the icon
2. `scripts/render-icons.ts` - Puppeteer script to render and resize

### Icon Component

```tsx
import { MessageCirclePlus } from 'lucide-react';

export function AppIcon() {
  return (
    <div
      style={{
        width: 128,
        height: 128,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          background: '#3C82F7',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MessageCirclePlus color="#FFF" size={56} strokeWidth={1.5} />
      </div>
    </div>
  );
}
```

### Render Script

1. Launch headless Puppeteer
2. Render React component to HTML
3. Screenshot at 128px with transparent background
4. Use Sharp to resize to 48, 32, 16px
5. Save all sizes to `icons/` directory

### npm Script

Add to package.json:
```json
"gen:icons": "npx tsx scripts/render-icons.ts"
```

## Output

Files generated in `icons/`:
- `icon16.png`
- `icon32.png`
- `icon48.png`
- `icon128.png`
