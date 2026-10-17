---
name: Dormitory Operations Core
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
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005a89'
  on-tertiary: '#ffffff'
  tertiary-container: '#0073ae'
  on-tertiary-container: '#e7f2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-trust, structured, and modern operational workspace for student housing administrators, facility managers, and residents. It blends clean Scandinavian SaaS functionalism with an architectural edge: dependable structure, crisp contrast, and tactile feedback.

### Emotional Response
- **Control & Clarity:** Complex multi-tenant allocations, billing, and maintenance queues feel structured and unhurried.
- **Modern Reliability:** Deep slate navigation anchored against clean white and cool tinted surfaces evokes security and operational efficiency.
- **Approachability:** Soft rounded boundaries (`rounded-2xl`) and light sky-blue highlights remove bureaucratic stiffness, maintaining a hospitality-driven tenant experience.

### Aesthetic Direction
- **Style:** Modern Corporate Minimal with refined atmospheric elevation and crisp borders.
- **Surfaces:** Pure white containers layered over subtle cool slate-tinted canvas backdrops (`#F8FAFC`).
- **Accentuation:** High-contrast electric blue action drivers with light-tinted state pills for instant operational triage.

## Colors

The palette balances utility and punchy status indicators. It leverages deep slates for institutional stability and vibrant blues for clear interactive affordances.

### Palette Architecture
- **Primary (`#2563EB`):** High-energy royal blue for key calls-to-action, primary state toggles, and active navigation indicators. Hover states shift to `#1D4ED8`, while active focus rings utilize `#3B82F6`.
- **Secondary / Structural Slate (`#0F172A` / `#1E293B`):** Heavy foundational tone reserved for persistent sidebars, top headers in desktop operations, high-priority data headers, and dominant modal titles.
- **Tertiary / Soft Sky (`#0284C7` & `#E0F2FE`):** Informational callouts, active room selection cards, occupancy tags, and subtle focus glows.
- **Neutral Canvas & Tiers:**
  - Base Canvas: `#F8FAFC` (Cool Off-White)
  - Card & Container Surface: `#FFFFFF` (Pure White)
  - Subtle Border & Dividers: `#E2E8F0`
  - Input & Recessed Backgrounds: `#F1F5F9`
  - Body Text: `#334155`
  - Subdued / Secondary Text: `#64748B`

### Status Indicators
- **Operational Green (`#10B981` / Tint `#ECFDF5`):** Paid invoices, vacant ready rooms, resolved work orders.
- **Warning Amber (`#F59E0B` / Tint `#FFFBEB`):** Pending lease expirations, maintenance in progress, overdue notices.
- **Critical Rose (`#EF4444` / Tint `#FEF2F2`):** Delinquent accounts, emergency repair dispatches, unauthorized occupancy alerts.

## Typography

Typography prioritizes legibility, tight vertical alignment for dense administrative data grids, and localized character render fidelity.

- **Typeface Selection:** Inter is used globally for Latin numbers, UI metrics, and operational dashboards. For Southeast Asian and bilingual localized deployments, map font cascades gracefully: `font-family: 'Inter', 'Noto Sans Thai', 'Sarabun', -apple-system, sans-serif;`.
- **Numerical Alignment:** Tabular lining numbers (`tnum`) must be forced across room numbers, utility metric counters, and payment balance tables.
- **Case & Tracking:** Labels below 12px utilize medium-to-semibold weights with slight positive letter spacing (`0.03em`) for instant readability during quick audits.

## Layout & Spacing

The layout is built on a responsive 12-column grid on desktop/tablet views and a single-column stacked container model on mobile viewports.

### Breakpoints & Geometry
- **Mobile (< 768px):** 4 columns or single-column flow, `16px` outer canvas margins, sticky bottom-sheet interactions, full-width data touch targets (minimum 44px tap heights).
- **Tablet (768px - 1024px):** 8 columns, `24px` outer canvas margins, collapsible icon-only slate sidebar navigation.
- **Desktop (>= 1025px):** 12 columns, `32px` outer margins, persistent 260px deep slate operational rail sidebar (`#0F172A`). Max content constraints capped at `1440px` for optimal tabular scanning.

### Spacing Harmony
Spatial increments adhere strictly to a 4px/8px modular rhythm. Component padding scales predictably: micro chips (`space-xs` vertical, `space-sm` horizontal), standard input targets (`space-sm` vertical, `space-md` horizontal), and structural cards (`space-lg` all sides).

## Elevation & Depth

Visual depth is achieved through layered cool slate container tiers rather than heavy drop shadows, maintaining an airy, modern, clean SaaS feel.

### Atmospheric Shadow Styles
- **Flat / Recessed:** No shadow. Surface `#F1F5F9` with an optional 1px border `#E2E8F0` for inner search wells and inactive room slot placeholders.
- **Level 1 (Card & Row Surface):** `0px 1px 3px 0px rgba(15, 23, 42, 0.05), 0px 1px 2px -1px rgba(15, 23, 42, 0.03)`. Combined with a crisp `1px solid #E2E8F0` perimeter border to guarantee contrast against `#F8FAFC` backgrounds.
- **Level 2 (Hovered Cards & Dropdowns):** `0px 4px 6px -1px rgba(15, 23, 42, 0.07), 0px 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs & Mobile Action Sheets):** `0px 20px 25px -5px rgba(15, 23, 42, 0.1), 0px 8px 10px -6px rgba(15, 23, 42, 0.04)`. Backdrop uses `rgba(15, 23, 42, 0.45)` with a 4px blur (`backdrop-blur-sm`).

## Shapes

The geometric signature uses smooth, friendly, but structured curvature (`rounded-2xl` for macroscopic containers).

### Corner Curvature Hierarchy
- **Primary Surfaces & Content Cards:** `rounded-2xl` (16px) creates a polished, premium aesthetic that differentiates the UI from traditional, rigid enterprise portals.
- **Form Controls & Action Buttons:** `rounded-xl` (12px) provides a natural grip and distinct tactile boundary.
- **Badges, Status Indicators & Avatars:** Fully rounded pill shapes (`rounded-full`) to distinctly separate meta-tags from clickable rectangular cards.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, radius `rounded-xl` (12px), height 40px (desktop) / 48px (mobile). Hover state `#1D4ED8`. Active state `#1E40AF`.
- **Secondary:** Surface `#F1F5F9`, text `#0F172A`, 1px border `#CBD5E1`. Hover: background `#E2E8F0`.
- **Danger / Destructive:** Surface `#FEF2F2`, text `#EF4444`, 1px border `#FCA5A5`. Hover: background `#FEE2E2`.

### Status Badges & Pills
- Pill shape (`rounded-full`), padding `2px 10px`, font `label-sm` uppercase tracking.
- **Occupied / Good Standing:** Green (`#ECFDF5` background, `#047857` label, with a 6px `#10B981` dot).
- **Maintenance / Pending:** Amber (`#FFFBEB` background, `#B45309` label, with a 6px `#F59E0B` dot).
- **Overdue / Vacant Damaged:** Rose (`#FEF2F2` background, `#B91C1C` label, with a 6px `#EF4444` dot).
- **Reserved / Processing:** Sky (`#E0F2FE` background, `#0284C7` label, with a 6px `#0284C7` dot).

### Cards & Dormitory Grid Items
- Background `#FFFFFF`, border `1px solid #E2E8F0`, corner radius `rounded-2xl`, internal padding `space-lg`.
- **Room Slot Variant:** Distinct room number in `title-lg` Slate-900, tenant counter avatar stack, status badge in upper right corner, and utility meter sparklines anchored at the bottom edge.

### Input Fields & Controls
- **Text Inputs:** Height 42px, radius `rounded-xl`, background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`, placeholder `#94A3B8`. Active focus triggers `2px solid #2563EB` with a `0 0 0 4px rgba(37, 99, 235, 0.12)` halo.
- **Checkboxes & Radios:** 18px box, `rounded-md` (checkbox) or `rounded-full` (radio). Inactive border `#94A3B8`. Active fill `#2563EB` with crisp white inner glyph.

### Operational Navigation
- **Desktop Sidebar:** Fixed 260px wide, background `#0F172A`, item hover `#1E293B`, active item background `rgba(37, 99, 235, 0.15)` with text `#38BDF8` and a 3px active indicator on the left border.
- **Mobile Navigation:** Bottom bar elevated at Level 3, white surface with `1px solid #E2E8F0` top border, active icon colored `#2563EB`.