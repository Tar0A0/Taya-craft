# TAYACRAFT Design System Master (Interior Architecture & Space-as-a-Service)

> Generated & Verified via `ui-ux-pro-max`
> **Category**: `#161 Home Decoration & Interior Design` × `#84 Architecture / Interior`
> **Aesthetic Direction**: Warm Japandi Editorial × Architectural Blueprint Precision (`Minimalism & Swiss Style + Organic Biophilic + 3D Product Preview`)

---

## 1. Visual Direction & Brand Essence

- **Core Metaphor**: *"Architectural Magazine meets Interactive 2.5D Living Studio"* (Casa BRUTUS / Kinfolk warmth combined with TAYA Kitchen's ±0.5mm 6063-T6 anodized aluminum engineering precision).
- **Surface Philosophy**: Tactile interior materials — Warm Linen Alabaster (`#FAF6F0`), Smoked Oak (`#4A3525`), Brushed Warm Brass/Amber (`#8E5B38`), Anodized Slate Teal (`#3B5F50`), and Circular Sage (`#4A663F`).
- **Anti-Patterns to Avoid**:
  - No neon/cyberpunk HUD brackets or sci-fi glow outside the 3D simulator canvas.
  - No OS-dependent emojis as structural icons (use 1.85px stroke vector SVGs).
  - No stacked multi-row button walls above the 3D viewport.

---

## 2. Color Tokens (Interior Material Palette)

| Token | Value | Material Reference | Role |
| :--- | :--- | :--- | :--- |
| `--dark-bg` | `#FAF6F0` | Warm Linen / Alabaster Plaster | Primary page canvas |
| `--surface` | `#EFE9DF` | Travertine / Raw Sand | Secondary section & pill surface |
| `--card-bg` | `#FFFEFA` | Gallery Matting White | Elevated card & modal surface |
| `--card-border` | `#E2D9CC` | Champagne Aluminum Hairline | Card & section dividers |
| `--amber` | `#8E5B38` | Warm Teak / Brushed Bronze | Primary brand accent & interactive CTA |
| `--amber-dark` | `#6E4326` | Smoked Walnut | Primary hover & active state |
| `--teal` | `#3B5F50` | Anodized Slate / Forest Green | Structural engineering & 6063-T6 track |
| `--green` | `#4A663F` | Biophilic Moss / Circular Sage | ESG sustainability & Life+ senior care |
| `--surface-dark` | `#1D1A16` | Charred Cedar (Shou Sugi Ban) | High-contrast impact metrics block |
| `--text-primary` | `#1F1C18` | Deep Charcoal Ink | Headings & primary copy (≥ 14:1 contrast) |
| `--text-secondary` | `#4A443A` | Warm Stone Grey | Body copy & descriptions (≥ 7.5:1 contrast) |
| `--text-muted` | `#686054` | Muted Clay | Captions & metadata (≥ 4.6:1 contrast) |

---

## 3. Tri-Font Architectural Editorial Typography

- **Display / Editorial Serif (`--font-display`)**: `'Noto Serif TC', Georgia, serif`
  - Used for `.section-title .title-heavy`, `.hero-tagline`, `.concept-intro .big-quote`, `.insight-quote p`, and `.core-problem p` to evoke tactile warmth, residential comfort, and magazine-grade authority.
- **UI & Body Sans (`--font-sans`)**: `'Inter', 'Noto Sans TC', system-ui, -apple-system, sans-serif`
  - Used for UI controls, navigation, cards, and body text (`line-height: 1.75`, comfortable `60ch–70ch` measure).
- **Technical Blueprint Mono (`--font-mono`)**: `'JetBrains Mono', ui-monospace, monospace`
  - Used for `.section-tag`, `.blueprint-phase-num`, `.arch-card-layer`, `.hero-spec-item strong`, and tabular engineering tolerances (`±0.5mm`, `6063-T6`).

---

## 4. Layout, Gallery Framing & Micro-Interactions

1. **Gallery-Framed Interior Photography**:
   - Interior renders (`.hero-showcase-frame`, `.insight-image`, `.vr-feature img`, `.track-system img`, `.circular-economy img`) use a warm 8px–10px gallery mat (`background: #FFFEFA; padding: 8px; border: 1px solid #E2D9CC`) with subtle elevation.
2. **Architectural Drafting Grid**:
   - Subtle 72px architectural grid lines (`rgba(142, 91, 56, 0.028)`) over Warm Linen (`#FAF6F0`) background.
3. **Motion & Transition Discipline**:
   - Micro-interactions use `200ms cubic-bezier(0.16, 1, 0.3, 1)` without layout-shifting jitter; respects `prefers-reduced-motion: reduce`.

