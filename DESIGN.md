---
name: PropfirmCore
description: Unbranded back-office UI for a self-hosted prop firm. Trader and admin apps share one shadcn system in packages/ui.
colors:
  ink: "oklch(0.145 0 0)"
  graphite: "oklch(0.205 0 0)"
  paper: "oklch(1 0 0)"
  paper-on-ink: "oklch(0.985 0 0)"
  mist: "oklch(0.97 0 0)"
  slate-muted: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  focus-gray: "oklch(0.708 0 0)"
  signal-red: "oklch(0.54 0.22 27)"
  signal-red-subtle: "oklch(0.962 0.015 27)"
  ledger-green: "oklch(0.5 0.12 155)"
  ledger-green-subtle: "oklch(0.962 0.04 155)"
  caution-amber: "oklch(0.52 0.115 65)"
  caution-amber-subtle: "oklch(0.962 0.04 85)"
  flag-violet: "oklch(0.5 0.18 300)"
  flag-violet-subtle: "oklch(0.962 0.02 300)"
  open-blue: "oklch(0.5 0.14 255)"
  open-blue-subtle: "oklch(0.962 0.015 255)"
  firm-teal: "oklch(0.48 0.08 195)"
  ink-dark-surface: "oklch(0.269 0 0)"
  signal-red-dark: "oklch(0.704 0.191 22.216)"
  ledger-green-dark: "oklch(0.8 0.14 155)"
  caution-amber-dark: "oklch(0.84 0.13 80)"
  flag-violet-dark: "oklch(0.8 0.115 300)"
  open-blue-dark: "oklch(0.8 0.1 250)"
  firm-teal-dark: "oklch(0.74 0.1 195)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  island: "16px"
  pill: "32px"
spacing:
  control: "32px"
  control-sm: "28px"
  table-head: "40px"
  cell-x: "8px"
  card-sm: "12px"
  card: "16px"
  page: "24px"
  section: "24px"
  sidebar: "208px"
  sidebar-collapsed: "64px"
  header: "56px"
components:
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper-on-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "{spacing.control}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "{spacing.control}"
  button-outline-hover:
    backgroundColor: "{colors.mist}"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
  button-destructive:
    textColor: "{colors.signal-red}"
    rounded: "{rounded.lg}"
    height: "{spacing.control}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "{spacing.control}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  badge:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper-on-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  badge-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.graphite}"
  badge-success:
    backgroundColor: "{colors.ledger-green-subtle}"
    textColor: "{colors.ledger-green}"
  badge-warning:
    backgroundColor: "{colors.caution-amber-subtle}"
    textColor: "{colors.caution-amber}"
  badge-flag:
    backgroundColor: "{colors.flag-violet-subtle}"
    textColor: "{colors.flag-violet}"
  badge-info:
    backgroundColor: "{colors.open-blue-subtle}"
    textColor: "{colors.open-blue}"
  badge-destructive:
    backgroundColor: "{colors.signal-red-subtle}"
    textColor: "{colors.signal-red}"
  brand-tile:
    backgroundColor: "{colors.firm-teal}"
    textColor: "{colors.paper-on-ink}"
    rounded: "{rounded.lg}"
    size: "32px"
  nav-item-active:
    backgroundColor: "{colors.mist}"
    height: "{spacing.control}"
  table-head:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "{spacing.table-head}"
---

# Design System: PropfirmCore

## Overview

**Creative North Star: "The Back Office"**

PropfirmCore is the room behind the counter. It ships to many prop firms, and each one puts its own name on the trader-facing door. The system is unbranded on purpose: gray surfaces, system type, and no logo beyond a placeholder glyph. What carries the identity is the firm's brand on top and the precision of the operations underneath. Trader-web and admin-web share one component library (`packages/ui`, shadcn `base-nova` on `@base-ui/react`), one token sheet, and one shell. Neither app gets a dialect of its own.

The system is compact and precise. Controls are 32px tall. Tables are dense, cards are flat and outlined with a hairline ring, and nothing is decorative. Depth is almost absent. The one moment of lift is the header, which detaches into a floating, blurred island once the page scrolls. Light and dark themes are both first-class, switched by class and defaulting to the OS preference.

Color is spent on two things only: **status**, and the **firm's mark**. Five status tones (success, warning, flag, info, destructive) each have a strong text color and a subtle tint. They live in `globals.css` and reach the apps through one `StatusBadge`. The firm's brand color (default Firm Teal) sits in identity spots: the logo tile, the active nav icon and text selection. Everything else stays gray.

**Key Characteristics:**
- Unbranded white-label canvas, with the firm brand layered on top
- Achromatic oklch neutral ramp, with color reserved for status and the firm's mark
- Compact controls with a 32px default height
- Flat surfaces: a hairline ring instead of shadows
- System sans throughout, no custom fonts
- One shell for both apps: collapsible sidebar, breadcrumb title bar, floating header on scroll

## Colors

The palette is achromatic oklch grays, plus five status tones and one swappable firm brand color. Every status pair passes WCAG AA: at least 5:1 in light and 4.9:1 in dark, measured on both the page and its own tint.

### Primary
- **Graphite** (`graphite`): primary buttons, default badges and the selected sidebar row's text. In dark mode it inverts to the light end of the ramp. It is the darkest actionable color, never used as a page background in light mode.

### Neutral
- **Ink** (`ink`): body text and headings in light mode. It is the page background in dark mode.
- **Paper** (`paper`): page and card background in light mode.
- **Paper on Ink** (`paper-on-ink`): text on Graphite fills, and foreground in dark mode.
- **Mist** (`mist`): secondary, muted and accent fills. Used for hover rows, the active nav item, secondary badges and ghost-button hover.
- **Slate Muted** (`slate-muted`): descriptions, placeholder text, the signed-in email and other secondary copy.
- **Hairline** (`hairline`): every border and input stroke in light mode. Dark mode uses white at 10% for borders and 15% for inputs.
- **Focus Gray** (`focus-gray`): focus ring color, applied at 50% alpha as a 3px ring.
- **Dark Surface** (`ink-dark-surface`): secondary and muted fills in dark mode.

### Secondary: Firm Brand
- **Firm Teal** (`firm-teal`, dark `firm-teal-dark`; CSS `--brand` / `--brand-foreground`): the white-label slot, and the only color a firm overrides. It appears on the 32px logo tile, the active sidebar item's icon, and text selection at 25%. It never fills primary buttons or focus rings, so a firm whose brand is red or green can't collide with status meaning.

### Tertiary: Status
Each tone has a strong color (`--{tone}`) for text and icons and a subtle tint (`--{tone}-subtle`) for fills. In dark mode, each tone is set separately for that theme rather than inverted from light.
- **Ledger Green** (`ledger-green`): success. Used for `passed`, `paid`, and a broker key that is Set.
- **Caution Amber** (`caution-amber`): warning. Used for `pending` and breach `warn`, plus the KYC-required alert. It needs attention but nothing is lost yet.
- **Flag Violet** (`flag-violet`): admin-only Flags. It is deliberately not amber, because a Flag does not count toward max warnings.
- **Open Blue** (`open-blue`): info, for in-progress states: account `active`, payout `approved`.
- **Signal Red** (`signal-red`): destructive, failed, rejected, banned, invalid. Light mode was darkened from stock shadcn (0.577 to 0.54 L) so 12px badge text clears 4.5:1 on its tint.
- `canceled` and any unknown status fall back to the outline badge.

### Named Rules
**The Tokens Only Rule.** Every hue enters through `globals.css`. App code never uses Tailwind palette utilities (`text-green-600`, `bg-amber-100`). A new status gets a tone in `StatusBadge`'s map, not a new color.

**The Brand Stays Out of State Rule.** `--brand` marks identity, never status or action. Primary buttons stay Graphite.

**The Red Is Destructive Rule.** Signal Red means "this deletes, fails, or is invalid". Negative P&L is not a failure state and does not get red by default.

## Typography

**Display Font:** none. The system has no display tier.
**Body Font:** Tailwind's default system sans (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** system monospace, used once, for shown-once secret keys.

**Character:** The platform's own sans, with no web fonts. It reads as native and neutral, and gives the firm's brand nothing to fight.

### Hierarchy
- **Headline** (600, 1.125rem): the brand mark in the sidebar ("Trader", "Admin", or the firm name later). Page titles are not rendered in content, because the breadcrumb owns them.
- **Title** (500, 1rem): card titles. Drops to 0.875rem in small cards.
- **Body** (400, 0.875rem): almost everything: tables, card content, buttons, breadcrumbs. Inputs use 1rem below the `md` breakpoint to stop iOS zoom, and 0.875rem above it.
- **Label** (500, 0.75rem): badges and form helper text.

### Named Rules
**The Crumb Is the Title Rule.** The breadcrumb's last item (`staticData.crumb`) is the page title. No heading in the main content may repeat it.

**The Fourteen Pixel Rule.** Operational text is 0.875rem. Add size only for structure (card title, brand), never for emphasis inside a table.

## Layout

There are two full-height columns. The sidebar is 208px wide and collapses to 64px, showing icon-only items with tooltips. Its width animates over 200ms with `cubic-bezier(0.16,1,0.3,1)`, and the animation is disabled under reduced motion. The main column has a 56px header and a scrolling body padded 24px, with 24px vertical rhythm between sections. There is no max content width yet: tables and cards fill the column.

Controls run 32px tall by default and 28px at the small size. Table header rows are 40px with 8px cell padding. Cards pad 16px, or 12px in `size="sm"`. Both apps are desktop-first (see PRODUCT.md). Below `md` (768px), the sidebar starts on the 64px icon rail, the signed-in email hides, and inputs use 1rem text.

Page content is a stack of `PageSection`s (h2, 1rem medium) 24px apart. A card holds the page's lead facts. Supporting facts sit in a bare `DescriptionList` under a section heading, not in another card.

### Named Rules
**The 32px Rule.** The default interactive height is 32px. Go to 28px only inside dense rows. Never exceed 36px (`lg`) in the apps.

## Elevation & Depth

The system is flat by default. Cards carry a 1px ring at 10% of the foreground color instead of a shadow, and borders do the rest of the separation. There is exactly one elevated moment: once content scrolls under the header, the header detaches into an island. It insets 12px, rounds to 16px, and becomes 80% opaque with a medium backdrop blur and a small shadow. Popovers and dropdowns use the shadcn defaults.

### Shadow Vocabulary
- **Island** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): the scrolled header only.

### Named Rules
**The Ring Not Shadow Rule.** Containers separate with a hairline ring or border. A shadow means "this floats above scrolling content", and only the header island and transient overlays float.

## Shapes

Corners are gently curved. The base radius is 10px (`--radius: 0.625rem`), and the scale derives from it: 6px, 8px, 10px, 14px. Buttons, inputs and the logo tile use 10px. Cards use 14px, the header island 16px, and badges are full pills. Small buttons step down to at most 10–12px. Borders are always 1px.

## Components

### Buttons
Buttons are compact and quiet. There are six variants, and the outline and ghost variants do most of the work.
- **Shape:** gently curved (10px), 32px tall, 10px side padding, 14px medium text, 16px icons with a 6px gap.
- **Primary:** Graphite fill with Paper on Ink text. Hover drops the fill to 80%. Use it for the single committing action in a view ("Buy", "Request", "Save").
- **Outline:** Paper background, Hairline border, Mist on hover. Use it for secondary actions and "Sign out".
- **Ghost:** no chrome until hover (Mist). Use it for icon buttons such as the sidebar toggle.
- **Destructive:** a 10% Signal Red tint with red text, 20% on hover. Never a solid red block.
- **Focus / Active:** a 3px Focus Gray ring at 50%. The button nudges down 1px when pressed. Disabled buttons sit at 50% opacity.

### Badges
- **Style:** a 20px pill with 12px medium text. The default is Graphite. Secondary is Mist. Destructive is a red tint. Outline is Hairline.
- **Tones:** `success`, `warning`, `flag`, `info` and `destructive` use a subtle tint fill with strong text.
- **StatusBadge:** use `<StatusBadge status={x} />` from `@propfirmcore/ui/components/status-badge` for any domain status. It maps the status to a tone plus a lucide icon (circle-dot, check, x, clock, banknote, ban, triangle-alert, flag), so the shape and the text label carry meaning without color.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Paper, or Graphite-family in dark mode.
- **Shadow Strategy:** none. A 1px ring at foreground/10 (see Elevation & Depth).
- **Border:** the footer gets a top border and a Mist/50 fill.
- **Internal Padding:** 16px, or 12px in small cards. Header, content and footer share the same spacing variable.

### Inputs / Fields
- **Style:** a transparent fill (Hairline/30 in dark mode), a 1px Hairline stroke, 10px corners, 32px height, 10px side padding.
- **Focus:** the border shifts to Focus Gray, plus the 3px ring at 50%.
- **Error / Disabled:** `aria-invalid` turns the border red and adds a 20% red ring. Disabled inputs sit at 50% opacity with an `input/50` fill.

### Tables
These are the workhorse of both apps (TanStack Table through `DataTable`).
- **Header:** 40px rows, medium weight, left aligned, no wrap.
- **Rows:** a bottom hairline and a Mist/50 hover. Selected rows fill with Mist. 8px cell padding, 14px text. Row actions sit in the first column: the first five render inline as 28px ghost icon buttons with a tooltip and an `aria-label` (destructive ones in Signal Red), and any beyond five go in a "More actions" overflow menu.
- **Toolbar:** search on the left, table actions on the right (`actions` prop on `DataTable`). Create buttons live there as primary buttons with a plus icon ("Add product", "Add broker", "Add user"). Never put them in a separate row above the table.

### Confirm Dialog
- **Use:** `const confirm = useConfirm(); if (await confirm({...}))` before any action that cannot be undone or that cuts someone off (delete, fail, reject, ban, rotate or revoke a key). `ConfirmProvider` is mounted once in each app's `main.tsx`. Never `window.confirm`.
- **Copy:** the title is the question with its subject ("Delete Mock?"). The description says what happens next, in one or two sentences. The confirm button names the action ("Delete broker"), never "OK" or "Yes".
- **Look:** 448px popover surface, 14px corners, a ring rather than a border, and a dimmed backdrop. Destructive confirms show a Signal Red warning tile and a tinted destructive button. Focus opens on Cancel; Escape and the backdrop cancel.

### Settings Forms
- **Layout:** one form, split into sections by a hairline. Each section has a 15rem left column (h2 title + one-sentence muted description) and a fields grid (two columns from `sm`, capped at 42rem). No cards. Mobile stacks the title above its fields.
- **Pick, don't type:** use `Select` for short fixed lists, `Combobox` for long ones (timezone, currency) with the code or UTC offset as a muted hint, `ChoiceGroup` radio cards when each option needs a sentence, `Switch` rows for on/off modules, and `type="time"` for clock times.
- **Validation:** the form resolves against the config package's schema (`firmSettingsSchema`), so the client rules are the server rules. Errors show under the field once it is touched.
- **Save bar:** `SaveBar` from `@propfirmcore/ui/components/settings`, sticky at the bottom, translucent with blur. It says "Unsaved changes" or "All changes saved". Discard appears only when dirty, and Save stays disabled until something changes. Create pages label it "Create broker" or "Create product".
- **Shared pieces:** `SettingsSection` + `SaveBar` drive the firm, broker and product forms. Read-only IDs are muted inputs with a "cannot change" hint. Rule fractions are edited as percentages with a % suffix, and stored 0–1.

### Record Pages (trading account)
- **Header:** the record's name as an h2 (never the breadcrumb title), its `StatusBadge` and a context badge, the ID in small mono, and actions top-right.
- **Then:** a figures card (four KPIs), the main chart (`LineChart` with dashed `ruleY` limits and a `ReferenceLegend`) beside a Details card, a Rules table (limit, threshold, now, headroom; "Breached" in Signal Red), then the history tables.

### Charts
- **Kit:** `ColumnChart`, `StackedBars`, `ChartLegend` and `ChartCard` in `@propfirmcore/ui/components/chart`. The plots render with **TanStack Charts** (`@tanstack/charts`): `barY`/`barX` marks, the built-in tooltip (themed via the `--ts-chart-tooltip-*` variables on the popover tokens) and its keyboard focus. Pick the form first: a single number is a KPI, not a chart.
- **Never shadcn/ui charts or Recharts.** Lint blocks `recharts` imports. Legends stay in HTML (`ChartLegend`) because the SVG legend is hidden from assistive tech, and status icons need to sit beside the label.
- **Colour:** single series use neutral `--chart-ink`, with the latest column in the foreground as emphasis. Series that mean a state use the `--chart-*` status fills (passed, active, failed, warn, flag). Never a categorical rainbow. Dark mode has its own validated fill steps. Account status stacks in the order Passed, Active, Failed, so red and green never touch (deuteranopia).
- **Marks:** columns at most 24px wide, with a 4px rounded data end and a square baseline. A 2px surface gap separates stacked segments. Grid is a solid hairline. Ticks are round (1, 2 or 5 multiples). Text uses text tokens, never the series colour.
- **Reading:** a legend for two or more series, with each status icon in the legend. Every column and segment is focusable with a full aria-label and shows a tooltip on hover and focus. Every `ChartCard` has a Table toggle. All-zero data shows a sentence, not an empty grid.

### Description List
- **Use:** label and value facts (account details, rulesets). Muted label column at max-content width, value column fills. 6px row gap, tabular numerals.
- **Empty:** a missing value renders a muted em dash, never a blank.

### Long Lists
- **Fills and snapshots** sort newest first and cap at 20 rows through `useShowMore`. A footer reads "Showing 20 of N" with a ghost Show all / Show less toggle.
- **Empty states** use `EmptyNote` (muted 14px): "No fills yet.", "No payouts yet."

### Numbers and Time
- **Amounts** use `formatAmount` (`packages/ui/src/lib/format.ts`): grouped, two decimals, no currency symbol. The trader API does not expose the firm currency, and Sim is not cash.
- **Enum values** (status, role, kind, mode, side, rule ids) display through `formatEnum`, in sentence case: `active` shows as "Active" and `debitOnApprove` as "Debit on approve". Stored and sent values stay as the API defines them. `StatusBadge` and `SelectValue` render functions apply it.
- **Rule fractions** use `formatPercent`. **Timestamps** use `formatDateTime` (Luxon, medium date with seconds, viewer's zone).
- **Tables** render tabular numerals. Numeric columns (amount, equity, qty, price) align right.

### Navigation
- **Sidebar:** 32px items with a 16px icon and an 8px gap. The active item (`aria-current=page`) gets a Mist fill. Collapsed, the labels become `sr-only` and show as tooltips on the right.
- **Header:** a sidebar toggle, then the breadcrumb, then on the right the theme toggle, the signed-in email in Slate Muted, and an outline "Sign out".
- **Brand slot:** a 32px rounded tile in Firm Teal (`bg-brand text-brand-foreground`) with a lucide `Building2` glyph, followed by the app name in Headline. The glyph is a placeholder for the firm's logo. The active nav item's icon also takes `--brand`.

### Floating Header Island (signature)
At rest, the header is a full-width bar with a bottom border. When a sentinel scrolls out of view, it animates over 200ms into an inset 16px-radius island: 80% background, `backdrop-blur-md`, small shadow. It is the system's only expressive motion, and it respects reduced motion.

## Do's and Don'ts

### Do:
- **Do** take every color from a token in `packages/ui/src/styles/globals.css`, and render domain statuses with `StatusBadge`.
- **Do** white-label by overriding `--brand` and `--brand-foreground` only. Re-check 4.5:1 for the foreground on the tile.
- **Do** keep interactive controls at 32px (the default size) and text at 0.875rem.
- **Do** separate containers with the hairline ring or border, not shadows.
- **Do** build both apps from `@propfirmcore/ui` components. Add a missing primitive to the package, not to an app.
- **Do** pair every status with a text label (badge text, cell text). Pass, fail, warn and flag carry money consequences.
- **Do** check every new surface in both light and dark themes.
- **Do** run every amount, percent and timestamp through `lib/format`. Raw floats and ISO strings never reach the screen.

### Don't:
- **Don't** add ad-hoc Tailwind palette colors (`green-600`, `amber-100`, …) in app code.
- **Don't** use `--brand` on buttons, focus rings or status.
- **Don't** render a heading that repeats the breadcrumb page title.
- **Don't** nest a Card (or any card-like surface) inside another Card.
- **Don't** use Signal Red for anything other than destructive, failed or invalid.
- **Don't** put PropfirmCore branding on trader-facing surfaces. The brand slot belongs to the firm.
- **Don't** add web fonts or a display type tier to operational screens.
