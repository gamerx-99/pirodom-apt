---
name: Siamese Modern Dormitory Operational Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#99efe5'
  on-secondary-container: '#006f67'
  tertiary: '#00685d'
  on-tertiary: '#ffffff'
  tertiary-container: '#008376'
  on-tertiary-container: '#f4fffb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#9cf2e8'
  secondary-fixed-dim: '#80d5cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Noto Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-lg-mobile:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Noto Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
  numeric-data:
    fontFamily: Noto Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

The design system establishes a high-trust, operational dashboard tailored for Thai dormitory and apartment managers operating in fast-paced rental environments with LINE OA integration. The system balances administrative rigor with approachable, stress-reducing workflows.

### Brand Personality & Emotional Objectives
- **Clarity & Authority:** Managers often review financial states, billing records, and room statuses in high-stress, time-sensitive contexts. The UI provides quiet clarity through structured layouts, high information density without clutter, and zero ambiguity in task states.
- **Pragmatic Modernism:** Combines crisp operational efficiency with modern hospitality sensibilities. It trades decorative complexity for spatial utility, crisp typography, and intentional status recognition.
- **Reliable Peace of Mind:** Instills trust across all tenant interactions, monthly utility audits, payment reconciliation, and maintenance escalations.

### Visual Style Movement
The design system leverages **Modern Precision Utility**:
- **Canvas Base:** Pristine light neutral backdrop (`#F8FAFC`) paired with elevated pure white cards (`#FFFFFF`).
- **Color Accent:** Rich deep teal (`#0D9488`) acting as the primary anchor, conveying institutional reliability with digital agility.
- **Accented State Framework:** Explicit, high-contrast semantic indicators for prompt visual triage (Emerald for paid/occupied, Amber for pending meter/due soon, Rose for overdue arrears/urgent issues, Slate for vacant/offline units).
- **Surface Elevation:** Subtle translucent borders layered over soft, diffused multi-stop shadows rather than stark structural outlines.

## Colors

The color palette is calibrated for high daily usage, screen fatigue prevention, and rapid status triage. It relies on a balanced slate neutral foundation with rich teal brand accents and high-visibility status tokens.

### Core Swatches
- **Primary (`#0D9488`):** Deep Teal. Used for primary calls-to-action, active navigation states, primary data filters, and key administrative triggers.
- **Secondary (`#0F766E`):** Forest Teal. Used for interactive hover states, primary headers, active selection outlines, and deep emphasis markers.
- **Tertiary (`#14B8A6`):** Bright Cyan-Teal. Used for active tabs, focused states, interactive badges, and progressive metric bars.
- **Neutral (`#64748B`):** Slate. Forms the bedrock for non-active icons, secondary copy, borders, and contextual metadata.

### Background & Surface Hierarchy
- **Canvas Background:** `#F8FAFC` (Slate 50) - Crisp, anti-glare canvas base.
- **Surface Primary:** `#FFFFFF` (White) - Standard card containers, modal backdrops, table bodies, and toolbars.
- **Surface Secondary:** `#F1F5F9` (Slate 100) - Table headers, meter comparison blocks, inactive input fields, and recessed containers.
- **Border Default:** `#E2E8F0` (Slate 200) - Structural card dividers and input borders.
- **Border Subtle:** `#F1F5F9` (Slate 100) - Internal tabular borders and subtle list separators.

### Typography Ink
- **Text Headings / Bold:** `#0F172A` (Slate 900)
- **Text Body:** `#334155` (Slate 700)
- **Text Muted / Footnotes:** `#64748B` (Slate 500)
- **Text Disabled / Hints:** `#94A3B8` (Slate 400)

### Status & State Palette
- **Success (Occupied / Fully Paid / Verified Receipt):**
  - Text & Border: `#059669` (Emerald 600)
  - Surface Fill: `#ECFDF5` (Emerald 50)
- **Warning (Due Soon / Pending Review / Unread Meter):**
  - Text & Border: `#D97706` (Amber 600)
  - Surface Fill: `#FFFBEB` (Amber 50)
- **Danger (Overdue Arrears / Urgent Maintenance / Disputed Receipt):**
  - Text & Border: `#E11D48` (Rose 600)
  - Surface Fill: `#FFF1F2` (Rose 50)
- **Info / Neutral (Vacant / Reserved / Under Renovation):**
  - Text & Border: `#475569` (Slate 600)
  - Surface Fill: `#F8FAFC` (Slate 50)
  - Accent Tint: `#6366F1` (Indigo 500) on `#EEF2FF` (Indigo 50) for Reserved bookings.

## Typography

The typographical foundation relies on **Noto Sans** (with full Unicode Thai glyph coverage, matching character height with Latin numerals). It provides consistent baseline alignment for bilingual Thai and English data interfaces.

### Application Rules
- **Tabular Figures:** Always apply `font-feature-settings: "tnum" 1` across financial records, room identifiers (e.g., "Room 204"), unit consumption figures (e.g., "142 kWh", "18 m³"), and phone numbers. This prevents horizontal jitter during updates and table column misalignments.
- **Thai Orthography Support:** Line heights must remain generous (`1.45` to `1.6`) across all body styles to accommodate upper and lower Thai tone marks (e.g., ไม้เอก, ไม้โท, สระอุ, สระอู) without clipping.
- **Weight Pairing:** Reserve `700` and `600` strictly for section anchors, primary numeric metrics (e.g., "฿124,500"), and table header labels. Avoid using weights lighter than `400` to guarantee outdoor and low-end mobile screen legibility.

## Layout & Spacing

The layout is built upon an adaptive 12-column fluid grid system designed for comprehensive dormitory supervision.

### Form Factors & Breakpoints
- **Desktop (>= 1280px):** Permanent 260px left sidebar navigation. 12-column grid with `margin: 2rem` and `gutter: 1.25rem`. The room grid renders 4 to 5 units per row, allowing complete visual inspection of all 19 units without excessive scrolling.
- **Tablet (768px - 1279px):** Collapsible compact rail sidebar (72px icons) expanding on trigger. 8-column layout with `gutter: 1rem` and `margin: 1.5rem`. The unit overview adapts to 3 columns per row.
- **Mobile (< 768px):** Hidden off-canvas drawer accessed via a persistent top app bar. Single or 2-column stacked fluid layout with `margin-mobile: 1rem` and `gutter-mobile: 0.75rem`.

### Content Reflow & Grid Rules
- **Executive KPI Row:** Stretches across the upper view. Desktop renders 4 equal cards (Total Revenue, Occupancy Rate, Pending Meters, Urgent Tickets). Reflows to 2x2 grid on tablet and single-column stack on mobile.
- **19-Unit Grid Canvas:** 18 residential suites and 1 ground-floor commercial unit. Standard residential rooms use standard unit cards; the commercial unit spans double column width on desktop to accommodate retail-specific metadata (commercial water/electric sub-meters and company name).
- **Split Workspace:** Below the unit grid, a 7:5 ratio split arranges the Bills/Invoicing Data Table (left 7 cols) against the Urgent Maintenance Work Order Feed (right 5 cols). On mobile, these stack sequentially with sticky priority toggles.

## Elevation & Depth

Visual hierarchy is communicated via clean tonal layers and subtle ambient shadows rather than stark structural outlines. This approach maintains a clean administrative feel across dense room matrices and tabular records.

### Elevation Levels
- **Level 0 (Flat / Canvas):** `#F8FAFC`. Zero elevation. Used strictly for the main canvas, workspace backgrounds, and table header rows.
- **Level 1 (Card & Modular Tile):** `#FFFFFF` surface with a 1px solid border in `#E2E8F0` and shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`. Applied to standard room cards, KPI overview tiles, and billing lists.
- **Level 2 (Interactive Floating / Hover):** `#FFFFFF` surface with border in `#CBD5E1` and shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`. Used on room card hovers, quick-action flyouts, and dropdown menus.
- **Level 3 (Modals, Overlays, & LINE Slips):** Pure `#FFFFFF` surface with shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`. Reserved for tenant slip verification dialogues, meter input sheets, and off-canvas mobile navigation drawers.

### Overlay Backdrop
- Modals and slide-overs introduce a translucent dark-slate scrim: `rgba(15, 23, 42, 0.45)` with a `backdrop-filter: blur(4px)` to isolate operational focus.

## Shapes

The design system implements a **Level 2 (Rounded)** shape configuration, balancing corporate administrative discipline with modern mobile-friendly tactile feel.

### Geometric Application
- **Standard UI Elements (`0.5rem` / 8px):** Form inputs, standard buttons, data table cards, filter chips, meter input fields, and standard room status cards.
- **Larger Modular Blocks (`1rem` / 16px):** KPI summary containers, tenant profile modal containers, and photo attachment wrappers for maintenance logs.
- **Full Pill (`9999px`):** Status indicator tags (e.g., "Paid", "Overdue", "Occupied"), quick filter pills, and count notification badges.
- **Micro Radii (`0.25rem` / 4px):** Internal progress bar tracks, tooltips, and sub-checkboxes within table rows.

## Components

### 1. Buttons
- **Primary:** Background `#0D9488`, text `#FFFFFF`, border none, border-radius `0.5rem`, font-weight `600`. Hover state `#0F766E`. Active state `#115E59`. Focus ring: 2px offset with `#14B8A6`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`. Hover state: background `#F8FAFC`, border `#CBD5E1`.
- **Destructive:** Background `#FFF1F2`, text `#E11D48`, border `1px solid #FECDD3`. Hover state: background `#FEE2E2`.
- **LINE OA Quick-Action Button:** Background `#06C755`, text `#FFFFFF`, font-weight `600`, icon prefix for direct invoice push notifications.

### 2. Status Badges & Chips
- Fully rounded pills (`border-radius: 9999px`) with fixed vertical padding `0.25rem` and horizontal padding `0.65rem`.
- Must pair a 6px solid dot indicator or semantic icon with text:
  - **Occupied / Paid:** `#ECFDF5` background, `#059669` text and dot.
  - **Due Soon / Meter Pending:** `#FFFBEB` background, `#D97706` text and dot.
  - **Overdue / Critical:** `#FFF1F2` background, `#E11D48` text and dot.
  - **Vacant / Ready:** `#F1F5F9` background, `#475569` text and dot.

### 3. Room Matrix Cards (19 Units)
- **Base Dimensions:** Fixed minimum height with flex layout. Border: `1px solid #E2E8F0`. Background `#FFFFFF`.
- **Header:** Room number in `label-lg` with tabular figures (e.g., "201", "304", "Shop 01"), paired with a right-aligned status badge.
- **Content:** Current tenant name in `body-sm`, monthly rate in `numeric-data`, and compact utility meter status indicators (Water / Electric glyphs tagged with warning amber if unread for the current billing cycle).
- **Commercial Unit Variant (Shop 01):** Distinctive subtle left accent stripe (`3px solid #0D9488`), wider footprint, and commercial tax ID display slots.

### 4. Input Fields & Meter Entry
- **Default State:** Height 40px, padding `0.5rem 0.75rem`, border `1px solid #CBD5E1`, background `#FFFFFF`, text `#0F172A`, border-radius `0.5rem`.
- **Focused State:** Border `#0D9488`, shadow `0 0 0 3px rgba(13, 148, 136, 0.15)`.
- **Meter Unit Inputs:** Integrated right-side add-on badge displaying "kWh" or "Unit/m³" on `#F1F5F9` background with explicit monospaced numeric input.

### 5. Data Tables (Billing & Invoicing)
- **Header:** Surface `#F8FAFC`, uppercase `label-sm` in `#64748B`, height 44px, bottom border `1px solid #E2E8F0`.
- **Rows:** Alternating subtle hover state `#F8FAFC`, height 56px, vertical border divider none, bottom border `1px solid #F1F5F9`.
- **Cells:** Tabular figures for baht currency amounts (e.g., "฿4,850.00"), right-aligned for monetary columns, left-aligned for tenant identification, center-aligned for payment slip previews.

### 6. Urgent Maintenance Work Orders
- **Card Structure:** Border-radius `0.5rem`, background `#FFFFFF`, padded with `1rem`. Left boundary features a 4px semantic severity indicator (Rose for emergency plumbing/electrical, Amber for general appliance check).
- **Metadata Stack:** Room tag, issue title in `headline-sm`, submission timestamp (e.g., "14:20 น."), and thumbnail of tenant-uploaded photo from LINE OA.