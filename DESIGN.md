---
name: Lloyds Medical OS
description: The clinic's register book open at today's page. Blue ink on ruled paper, bound in a navy spine; red, amber and green only ever mean something.
colors:
  # Day sheet. Values are the hex form of the RGB triplets declared in
  # client/src/index.css (:root); the night sheet and the paper palette are
  # recorded in .impeccable/design.json. Keys are the project's own token
  # names, so `bg-canvas`, `text-ink-2`, `border-line-strong` map directly.
  canvas: "#E4EDFA"
  surface: "#FFFFFF"
  subtle: "#F0F5FC"
  line: "#BFD0EA"
  line-soft: "#D8E3F4"
  line-strong: "#8CA6D0"
  ink: "#0A1836"
  ink-2: "#30466E"
  ink-3: "#4E648C"
  ink-inverse: "#FFFFFF"
  brand: "#0E4ED6"
  brand-deep: "#082A80"
  brand-wash: "#DAE6FC"
  primary: "#0E4ED6"
  primary-hover: "#0A40B8"
  primary-active: "#082A80"
  primary-fg: "#FFFFFF"
  focus: "#0E4ED6"
  spine: "#071E58"
  spine-hover: "#0E2C74"
  spine-ink: "#E2EBFC"
  spine-ink-2: "#9EB6E4"
  cover-ink-2: "#D6E4FF"
  on-blue-ok: "#7EE2B2"
  on-blue-warn: "#FFD678"
  critical: "#BA1624"
  critical-wash: "#FDF0F1"
  critical-line: "#F3C4C8"
  warn: "#985404"
  warn-wash: "#FDF6E8"
  warn-line: "#EFD6A8"
  ok: "#086C4A"
  ok-wash: "#ECF8F2"
  ok-line: "#B4E0CA"
  info: "#0E4ED6"
  info-wash: "#E4EDFD"
  info-line: "#B8CEF4"
  t-1: "#082A80"
  t-2: "#0E4ED6"
  t-3: "#006CB0"
  t-4: "#1C3EAA"
  t-5: "#2C5896"
  t-6: "#107AC4"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  clock:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "tnum, lnum"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "tnum, lnum"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "tnum, lnum"
  body-small:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  caption:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "normal"
  control:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.06em"
  section:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  form-label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "2px"
  stamp: "3px"
  md: "4px"
  lg: "6px"
  full: "9999px"
spacing:
  px: "1px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  rule-pitch: "28px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-deep}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-hover:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.brand-deep}"
  button-active:
    backgroundColor: "{colors.brand-wash}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-fg}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-cover:
    backgroundColor: "rgba(255, 255, 255, 0.10)"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-danger:
    backgroundColor: "{colors.critical}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-sm:
    padding: "0 9px"
    height: "26px"
  button-lg:
    padding: "0 16px"
    height: "38px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "34px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  panel-head:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "10px 16px"
  metric-cell:
    backgroundColor: "{colors.surface}"
    padding: "14px 16px"
  metric-label:
    textColor: "{colors.brand-deep}"
    typography: "{typography.label}"
  metric-value:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
  section-title:
    textColor: "{colors.brand-deep}"
    typography: "{typography.section}"
  pill-neutral:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "1px 7px"
  pill-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
  pill-warn:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
  pill-critical:
    backgroundColor: "{colors.critical-wash}"
    textColor: "{colors.critical}"
  pill-info:
    backgroundColor: "{colors.info-wash}"
    textColor: "{colors.info}"
  stamp:
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-deep}"
    typography: "{typography.control}"
    padding: "0 14px"
    height: "36px"
  tab-active:
    backgroundColor: "{colors.brand-deep}"
    textColor: "#FFFFFF"
  tab-count:
    backgroundColor: "{colors.brand-wash}"
    textColor: "{colors.brand-deep}"
    rounded: "{rounded.stamp}"
    padding: "0 6px"
    height: "18px"
  chip:
    rounded: "{rounded.md}"
    size: "30px"
  spine-item:
    textColor: "{colors.spine-ink}"
    padding: "8px 12px 8px 10px"
  spine-item-hover:
    backgroundColor: "{colors.spine-hover}"
    textColor: "#FFFFFF"
  spine-item-active:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  cover:
    backgroundColor: "{colors.brand}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "20px 20px 16px"
  cover-label:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "6px"
---

# Design System: Lloyds Medical OS

Recorded 2026-09-09 from the shipped build (client/src/index.css,
client/tailwind.config.js and the components under client/src), after the
finish review passed. It replaces the red-branded interface entirely; nothing
from that world is carried forward. Where the direction contract in
client/index.html and the build disagree, the build wins and the difference is
noted here.

## Overview

**Creative North Star: "The Carbon-Copy Blue Ledger"**

The interface is the health-centre register book, open at today's page. A
deep navy cloth spine down the left carries the sections; the facility's name
sits on a cobalt cover band at the head of the page; the working surface is
ice-blue ledger paper ruled at a fixed pitch, on which white sheets lie with
feint blue rules, printed small-cap column heads, and figures set large in
tabular numerals so a column adds up by eye. Status is stamped, not glowing:
a bordered word in the ink of the surface it sits on. It refuses the analytics
dashboard of floating KPI cards on grey.

One rule governs colour. Blue is the material of the book: every structural
element, tint and heading is a shade of it. Red, amber and green are reserved
for clinical and operational state, so a coloured mark on this screen always
means someone should act. The night sheet is the same register as a carbon
copy: light ink on carbon-blue paper for a ward at three in the morning, not a
second design.

It is an Operate surface for staff who did not grow up with software, read
on a ten-year-old laptop under a bright window and on a tablet at the foot of
a bed. Density is high but ruled; every figure has a printed head above it and
one line of context beneath it; every action is a labelled button. The
confirmed anti-references are the previous red-branded shell, KPI cards
floating on grey, decorative gradients and glass, and any colour used for
identity on a clinical figure.

**Key Characteristics:**
- Ledger blue throughout: navy spine, cobalt cover, ice paper, white sheets, blue ink.
- Red, amber and green are state words, never decoration; the text carries the meaning.
- Ruled, not floated: figures live in one strip separated by hairline rules, sheets lie flat.
- Printed column heads (10.5px, bold, tracked, uppercase, deep blue) over figures and columns only.
- Archivo Variable, self-hosted, with tabular lining numerals everywhere by default.
- Two sheets for two rooms: the day sheet at the counter, the carbon copy on the ward.
- One authored motion, the page turning when a section tab is chosen.
- 4px corners; index tabs rounded on top; the open spine tab rounded on its page edge.

## Colors

A single blue ink, from carbon to ice, does the whole book; three state hues sit inside it and mean something every time they appear.

Every colour is declared once as an RGB triplet on `:root` and again on
`[data-theme='dark']`, and Tailwind resolves `bg-brand`, `text-ink-2`,
`border-line-strong` and every opacity modifier through those variables. A
component is written once and renders correctly on both sheets. The paper
palette (print preview and the print engine) pins the day values with a white
canvas whatever the screen theme.

### Primary
- **Cobalt Ink** (`brand`, #0E4ED6): the book's blue. The cover band, the primary button, the focus ring, the favicon stroke, and the wash it leaves on paper. Also the `info` state, which is deliberately the same ink.
- **Deep Cover** (`brand-deep`, #082A80): the ink of every printed head: column heads, metric labels, section titles, the filled index tab, secondary button text, the rule under the tab row.
- **Cobalt Wash** (`brand-wash`, #DAE6FC): the pale ground for a pressed button, a selected menu row, a tab count, the open spine tab at night.
- **Pressed Cobalt** (`primary-hover`, #0A40B8) and **Held Cobalt** (`primary-active`, #082A80): the primary button's hover and press. The primary button family is a separate token from `brand` because at night the button stays a saturated mid-blue with white text while `brand` lightens to a text ink.

### Secondary
- **Spine Navy** (`spine`, #071E58): the bound edge. The whole navigation column, the 10px bound edge of the sign-in cover, the browser theme colour.
- **Spine Lift** (`spine-hover`, #0E2C74): a hovered section on the spine.
- **Spine Ink** (`spine-ink`, #E2EBFC) and **Spine Ink 2** (`spine-ink-2`, #9EB6E4): the two inks printed on the cloth. Primary labels use the first; the facility line, the status list captions and the eyebrow-height label under the mark use the second.
- **Cover Ink 2** (`cover-ink-2`, #D6E4FF): the secondary ink on the cobalt cover band and the sign-in cover, measured at 5.33:1 on cobalt.
- **Lifted Green** (`on-blue-ok`, #7EE2B2) and **Lifted Amber** (`on-blue-warn`, #FFD678): the state hues raised to clear 4.5:1 on navy and cobalt. Same meaning as `ok` and `warn` on paper.

### Tertiary
Six identity tints, all blues from the same bottle. A tint names a department or a role on an icon chip or a tab; it never reports a state, and none of the six is red, amber or green.
- **Registry** (`t-1`, #082A80), **Outpatients** (`t-2`, #0E4ED6), **Pharmacy** (`t-3`, #006CB0), **Ward** (`t-4`, #1C3EAA), **Governance** (`t-5`, #2C5896), **Safety** (`t-6`, #107AC4). A chip is drawn as the tint at 9% opacity behind the tint at full strength (`--t-wash: 0.09`; 0.18 at night).

### Neutral
- **Ledger Paper** (`canvas`, #E4EDFA): the ground the sheets lie on, ruled every 28px at 55% of the rule colour. Also the manifest background and the open spine tab, which is cut in the paper colour so it joins the page.
- **Sheet White** (`surface`, #FFFFFF): every panel, table, field, menu, dialog, toast and metric cell.
- **Ice Band** (`subtle`, #F0F5FC): the printed head of a panel, a table header, a hovered row, a hovered secondary button.
- **Rule** (`line`, #BFD0EA), **Feint Rule** (`line-soft`, #D8E3F4), **Heavy Rule** (`line-strong`, #8CA6D0): the three rulings of the register. Feint rules separate table rows and the cells of a metric strip; the rule borders sheets and fields; the heavy rule closes a printed head, borders a secondary button, and draws the double rule under a total.
- **Ink** (`ink`, #0A1836), **Ink 2** (`ink-2`, #30466E), **Ink 3** (`ink-3`, #4E648C): body ink, secondary ink for table cells and descriptions, tertiary ink for captions, placeholders, units and the unrecorded dash (5.96:1 on white).

### Clinical state
Each has a full-strength ink, a wash and a line, so a stamped word, a tinted row and a bordered notice are all available without inventing a shade.
- **Critical** (`critical`, #BA1624; wash #FDF0F1; line #F3C4C8): act now. Urgent triage, an allergy refusal, stock below reorder, a destructive button.
- **Warn** (`warn`, #985404; wash #FDF6E8; line #EFD6A8): check before the shift ends. A long wait, a stale copy, sample data on screen, a flagged dispensation.
- **OK** (`ok`, #086C4A; wash #ECF8F2; line #B4E0CA): recorded and in order. A completed setup step, a fresh copy, a normal observation.
- **Info** (`info`, #0E4ED6; wash #E4EDFD; line #B8CEF4): a notice with no clinical weight, in the book's own ink.

### The night sheet
The carbon copy. Same tokens, redefined under `[data-theme='dark']`; nothing else changes. The status hues are lightened for a dark ground; their meaning is unchanged.

| Token | Night | Token | Night |
| --- | --- | --- | --- |
| canvas | #060E22 | brand | #7AA8FF |
| surface | #0B1834 | brand-deep | #4678F0 |
| subtle | #102042 | brand-wash | #142C60 |
| line | #243A68 | primary / hover / active | #205CE2 / #306CEE / #184ED0 |
| line-soft | #1A2E58 | focus | #8CB8FF |
| line-strong | #4664A0 | spine / spine-hover | #040C22 / #0C1A3C |
| ink | #E4ECFC | spine-ink / spine-ink-2 | #DCE6FA / #96ACD8 |
| ink-2 | #B0C2E2 | cover-ink-2 | #E2ECFF |
| ink-3 | #849AC4 | critical / wash / line | #FF7078 / #3C161E / #60242E |
| ink-inverse | #060E22 | warn / wash / line | #F0AC46 / #382810 / #5C4018 |
| t-1 … t-6 | #A0BAFF #7AA8FF #5ABEF0 #8CA8FA #82A0DC #64C4F0 | ok / wash / line | #56D296 / #0C3028 / #16503E |
| t-wash | 0.18 | info / wash / line | #7AA8FF / #142C60 / #28488C |

At night three things are drawn differently on purpose: the cover band is the brand wash with a 3px cobalt rule along its top edge, never a cobalt slab; the spine gains a 1px rule on its right edge because spine and page are both carbon; and the open spine tab is filled with the brand wash in white ink rather than cut to the page colour. Printed heads (`section-title`, `metric-label`, table heads, the tab row rule) switch from `brand-deep` to `brand`.

### Measured contrast
The floor is 4.5:1 for all text on both sheets. Values measured on the shipped build:

| Pair | Day | Night |
| --- | --- | --- |
| Metric label on sheet | 12.7:1 | — |
| Section title on canvas | 10.8:1 | — |
| Ink 3 on sheet | 5.96:1 | — |
| Cover secondary ink on cover | 5.33:1 | 11.3:1 |
| Cover title on cover | — | 13.5:1 |
| Primary button label | — | 5.69:1 |
| Tab count | — | 5.69:1 |

### Named Rules
**The Blue Ink Rule.** Everything structural is a shade of the book's blue: paper, rules, heads, tints, spine, cover. Red, amber and green appear only as `critical`, `warn` and `ok`, and only when the record holds that state. An element in one of those hues with no state behind it is a defect.

**The Carbon Copy Rule.** Night is the same register printed through carbon paper. Tokens are redefined; components are not. Anything drawn differently at night (the cover's top rule, the spine's edge rule, the open tab's wash) exists only because the carbon ground removed a contrast the day sheet had.

**The White Label Rule.** The Lloyds Metals mark (black gear badge, red block) is the company's official mark and is never recoloured, inverted or tinted. On any blue surface it sits on a white label (`cover-label`) with its own hairline shadow. Its red is the only red on screen that is not a state.

**The Lifted State Rule.** A state word on navy or cobalt uses `on-blue-ok` or `on-blue-warn`, never the paper-sheet `ok` or `warn`, which would fall below 4.5:1 on blue.

## Typography

**Display Font:** Archivo Variable (with system-ui, Segoe UI, Roboto, Helvetica Neue, Arial)
**Body Font:** Archivo Variable (same stack)
**Label/Mono Font:** none. The `font-mono` stack exists in the Tailwind config for observation strings only (the bed card's admission observations); it is not a design voice.

**Character:** One grotesque does the whole register. Archivo's wide, upright letterforms and its tabular figures read like a printed ledger rather than a screen; hierarchy comes from weight and size alone, never from a second face. The font is bundled through `@fontsource-variable/archivo` in `main.jsx` because the clinic has no internet; a web-font CDN request would hang and fall back silently.

### Hierarchy
- **Display** (800, 28px on the cover band, 24px on a phone; 30px to 36px on the sign-in cover, line-height 1.25, -0.025em): the facility name. The heaviest text on the page and the only text over 30px apart from the clock.
- **Clock** (800, 34px, line-height 1, -0.025em, tabular): local time on the cover band. There is one clock on the board; the top bar's clock is hidden while the board's cover is on screen.
- **Headline** (800, 30px, line-height 1, -0.025em, tabular lining): the figure in a metric cell. A unit beside it drops to 14px bold in `ink-3`; an unrecorded value prints an em dash in `ink-3`.
- **Title** (700, 13px, -0.005em): a panel's printed head. Dialog and toast titles are 14px at 600; page-level headings inside sheets are 16px at 700. All headings carry -0.012em by default.
- **Body** (400, 14px, line-height 1.5, tabular lining): base text. Table cells are 13px in `ink-2`. Prose is capped at 48rem (`max-w-3xl`) on the board and 28rem (`max-w-md`) inside a cell or a list row.
- **Body small** (400, 12px, line-height 1.625): the most used size in the build. Detail lines under a title, notice bodies, list-row descriptions.
- **Caption** (400, 11px, line-height 16px): the `text-2xs` step. Metadata, footnotes, the status list on the spine, the "figures as of" explanation under the cover.
- **Control** (700, 13px): every button and index tab. Small buttons drop to 12px, large to 14px.
- **Label** (700, 10.5px, 0.06em to 0.08em, uppercase, `brand-deep`): the printed head over a column or a figure: table heads (0.06em), metric labels (0.07em), stamps (0.08em), cover readings (0.12em), pills (0.04em).
- **Section** (700, 11px, 0.08em, uppercase, `brand-deep`): a section title on the ruled ground, with an optional caption beside it at the baseline.
- **Form label** (700, 11px, sentence case, `ink-2`): above a field. Not uppercase, not tracked; a form is filled in, not printed.

### Named Rules
**The Column Head Rule.** A small-cap tracked head is printed over a figure, a column or a section of the ruled ground. It is never placed above a sentence heading as an eyebrow or kicker; a heading carries its own weight.

**The Tabular Rule.** Numerals are tabular and lining everywhere, set once on `body` and again on `.metric-value`, `.paper` and every `.num` cell. A figure is always compared against the one above it.

**The One Family Rule.** Archivo Variable carries every role. No second face, no system display face, no monospace as a costume. Hierarchy is weight (400, 600, 700, 800) and size.

## Layout

The page is a book lying open: a fixed 256px spine on the left, a 56px white top bar across the head, and the ruled ground beneath, holding sheets in a single column up to 1600px wide with 16px padding on a phone and 24px from 768px up. Everything inside the column is stacked with 16px between sections (`space-y-4`) and 8px between a section title and its strip (`space-y-2`).

The ground is `.sheet-ground`: canvas colour ruled every 28px (`--rule-pitch`) with the rule colour at 55%. The rules show only in the gutters between sheets, which is where paper shows on a desk; sheets themselves are unruled white.

**The cover band** runs the full column width at the top of the board: the facility name and location on the left, the clock and two readings on the right, and a lower strip (black at 10% over the cobalt) holding the "figures as of" stamp, a one-line reassurance, and the cover button. Under it, one caption explains the dash.

**Metric strips** are one sheet divided into cells by 1px of `line-soft` (`gap-px` on a `bg-line-soft` grid): two columns on a phone, three from 640px, and the strip's full count (3, 4, 5 or 6) from 1024px. A cell is 16px by 14px of padding with head, figure and context stacked at 8px.

**Index tabs** sit on a 2px `brand-deep` rule with 4px between them. They wrap into a second row rather than scrolling out of sight; the active tab overlaps the rule by 2px so it reads as the open page.

**Sheets** are `.panel`: white, one rule border, 4px corners, a hairline shadow. A panel head is 10px by 16px on the ice band, closed by a heavy rule. List rows are 12px by 16px separated by feint rules; table cells are 9px by 16px; table heads 7px by 16px.

**Responsive behaviour.** Below 1024px the spine becomes a drawer that slides in over the page under the overlay shadow, opened from a button in the top bar; the top bar's facility name, search and most labels give way to icon-only buttons. On a phone the sign-in sheet comes before the cover (`order-first`) so the form is on screen without scrolling; from 1024px the cover takes the left 1.15 fractions and the sheet the right. Touch pointers grow the small button to 32px and the tab to 40px; desktop density is unchanged.

**Text size** is a whole-interface zoom (1.15 for Large, 1.3 for Largest) set per device in the top bar, so a label can never outgrow the value beside it.

### Named Rules
**The Ruled Strip Rule.** Related figures share one sheet separated by hairline rules. A row of individually bordered, shadowed cards is the rejected world.

**The Measure Rule.** Explanatory prose stops at 48rem; a cell's context line at its cell, truncated with a title attribute; a list row's detail at 28rem.

## Elevation & Depth

Flat by material. A sheet lies on the desk under a hairline shadow that says "paper", and nothing on the page floats. Depth is otherwise carried by the rulings (feint, rule, heavy, double) and by tone (the ice band under a printed head, the wash under a pressed control). Shadows are reserved for the few things that genuinely leave the page: menus, dialogs, toasts, the navigation drawer, and the sign-in sheet. Every shadow has an offset and a soft blur; there are no halos, no rings and no glow.

### Shadow Vocabulary
- **Panel** (`--shadow-panel`: `0 1px 2px rgba(7,30,88,0.07), 0 1px 1px rgba(7,30,88,0.04)`; night `0 1px 2px rgba(0,0,0,0.45)`): every sheet at rest. Navy-tinted so it reads as paper on blue.
- **Raised** (`--shadow-raised`: `0 4px 12px -2px rgba(7,30,88,0.14), 0 2px 4px -2px rgba(7,30,88,0.08)`): defined for a sheet that must sit above its neighbours; the board itself does not use it.
- **Overlay** (`--shadow-overlay`: `0 24px 48px -12px rgba(7,30,88,0.30), 0 8px 16px -8px rgba(7,30,88,0.16)`; night `0 24px 48px -12px rgba(0,0,0,0.72), 0 8px 16px -8px rgba(0,0,0,0.5)`): menus, dialogs, toasts, the drawer, the sign-in sheet.
- **Cover** (`0 2px 6px -1px rgba(7,30,88,0.28), 0 1px 2px rgba(7,30,88,0.12)`): the cover band, with a 7% white sheen from the top edge fading by 60% so the cloth catches light.
- **Label** (`0 1px 2px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)`): the white label carrying the mark.
- **Open tab** (`0 1px 2px rgba(0,0,0,0.18)`): the open section on the spine, so the cut tab sits fractionally proud of the cloth.
- **Scrim** (`--scrim`: `rgba(7,30,88,0.52)`; night `rgba(2,6,18,0.66)`): under dialogs. Navy, not black, so the night shift is not flashed.

### Named Rules
**The Flat Sheet Rule.** A sheet gets the panel shadow and nothing more. Only an element that is not part of the page (menu, dialog, toast, drawer) gets the overlay shadow. Hover is a tone change, never a lift.

## Shapes

Square-cornered like a page, softened by 4px. `rounded` and `rounded-md` are both 4px; `rounded-lg` (6px) is the top of the scale and the shipped board does not reach for it. The `rounded-xl` and `font-black` classes that remain in a handful of components not yet migrated (ECGMonitor, PatientCardModal, ActivityBlackBox, HospitalSpatialMap, the printable patient record) belong to the previous world and are not part of this system. Stamps, pills, tab counts and spine counts use 3px so they read as smaller objects. `rounded-sm` (2px) frames the mark and the sort button. The only fully round shapes are the `Bar` track and fill and the 6px status dot on the cover strip.

Silhouettes carry the book: an index tab is rounded on its top corners only and sits on the rule; the open item on the spine is rounded on its left corners and square on the right where it meets the page; the cover band is a bound sheet with a 1px `brand-deep` border; the sign-in cover carries a 10px navy strip down its left edge as the bound edge of the book, and this is the one place a wide coloured edge is permitted.

Borders are rulings: 1px everywhere, 2px under the tab row, 1.5px in `currentColor` on a stamp, 3px double under a total. A form field is a ruled box; focus is a 2px `focus` outline drawn inside the rule (offset -1px on a field, +2px elsewhere).

## Components

### Buttons
Character: printed controls, bold and short, that name their action.
- **Shape:** 4px corners; 32px tall, 12px side padding, 13px bold, 6px gap to a 16px icon. `btn-sm` 26px by 9px at 12px; `btn-lg` 38px by 16px at 14px.
- **Secondary (`.btn`, the default):** white sheet, heavy-rule border, `brand-deep` label. Hover: ice band and a `brand` border. Press: `brand-wash`. At night the label is `ink`.
- **Primary (`.btn-primary`):** `primary` fill and border, white label. Hover `primary-hover`, press `primary-active`. One per group; on the board it is "Check in a patient".
- **Cover (`.btn-cover`):** white at 10% with a 42% white border and white label, for a button on the cover band or the spine. Hover 18% with a solid white border.
- **Danger (`.btn-danger`):** `critical` fill, white label, darker on hover. Red because the consequence is; never the default button in a dialog.
- **Disabled:** 50% opacity, `not-allowed` cursor. Loading: the label changes to the verb in progress ("Saving", "Reading") with a spinning icon.
- **Focus:** 2px `focus` outline offset 2px; white outline on blue surfaces.

### Pills and stamps
- **Pill (`.pill`):** a stamped, bordered word. 10.5px bold uppercase 0.04em, 18px line, 1px by 7px padding, 3px corners, wash fill, ink and line in the state hue. Tones: neutral, ok, info, warn, critical. The word carries the meaning; the colour confirms it.
- **Stamp (`.stamp`):** the same word drawn in `currentColor` with a 1.5px border and 0.08em tracking, for a mark on a coloured surface ("Figures as of just now" on the cover, in white or `on-blue-warn`).
- **Counts:** a tab count is 18px tall on `brand-wash` in `brand-deep`; on the open tab it inverts to white at 18%. A spine count is solid: white at 14% for a neutral count, `warn` or `critical` fill for a count that means something.

### Chips
- **Style:** a 30px square with 4px corners, the tint at 9% behind the tint at full strength with a 30% tint border. The tint names a department (`chip-1` to `chip-6`) or, when the icon reports state, a state hue (`chip-ok`, `chip-warn`, `chip-critical`, `chip-info`).
- **On the spine:** every chip is drawn in spine ink on white at 8%, whatever its tint; the open section's chip takes the `brand` tint.
- **Not on figures:** a metric cell carries no chip; its identity is its printed head.

### Cards / Containers
- **Sheet (`.panel`):** white, 1px rule, 4px corners, panel shadow. The only structural container. Nested sheets are not used.
- **Panel head (`.panel-head`):** ice band, 10px by 16px, closed by a heavy rule; title 13px bold and an optional 11px note in `ink-3`; controls on the right wrap under the title when they no longer fit beside it.
- **Metric strip (`MetricStrip`):** one sheet cut into cells by 1px feint rules. **Metric cell:** printed head, 30px figure (tinted by state tone only), one truncated context line. A cell with an action is a button: ice on hover and a 3px `brand` (or tint) rule drawn along its bottom edge from the left in 180ms.
- **Notices:** a sheet tinted by state (`border-warn-line bg-warn-wash`) with a state icon, a bold title, a detail line and one button. Errors use the critical wash; a notice on the sign-in sheet uses the info wash.
- **Ledger total (`RevenueRow` strong):** a printed head on the left, the figure in 18px bold on the right, on the ice band at 60%, closed by a 3px double heavy rule.
- **Bed card (ward):** a sheet with a head (bed code, ward, bed type) and a status pill, a body of label and value pairs, and a full-width button at the foot. No ring, no coloured edge; the pill says occupied or available.

### Inputs / Fields
- **Style:** 34px tall, 10px side padding, 13px, white, 1px rule, 4px corners; placeholder in `ink-3`. Textareas grow with 8px vertical padding; selects keep 6px right padding.
- **Label:** 11px bold `ink-2`, sentence case, 4px above.
- **Focus:** the border and a 2px outline in `focus`, offset -1px so the ring sits inside the rule.
- **Error:** a critical-wash box under the form (`border-critical-line bg-critical-wash text-critical`, 12px) with `role="alert"`, never a red field.

### Navigation
- **Spine (`.spine`):** 256px of `spine` navy with `spine-ink` text; sticky on a laptop, a drawer under the overlay shadow below 1024px. At the top, the mark on its white label, then the "Papua New Guinea operations" line (10px bold 0.14em uppercase in `spine-ink-2`) and the facility description in caption size. At the foot, on black at 20% above a white-at-10% rule: the hand-over button (white at 7% with a 15% border) and a three-line status list (Records, Off-site copy, Network) whose values are bold spine ink or a lifted state colour.
- **Spine item (`.spine-item`):** 14px semibold, a 28px chip and the section name, 8px by 12px padding, left corners 4px. Hover lifts to `spine-hover` in white. The open section (`aria-current="page"`) is cut in `canvas` with `ink` text and the open-tab shadow, joining the page to its right; at night it is `brand-wash` in white.
- **Top bar:** 56px, white, 1px rule beneath, sticky. Facility name and product name on the left, the search field filling the middle from 1024px, then the clock (from 1280px), Check in (primary), Dispense, Protected export, the screen control and the staff menu, all `btn-sm`. Below 1024px the navigation button appears and the labels collapse to icons.
- **Index tabs (`.tab`):** 36px tall, 14px side padding, 13px bold `brand-deep` on white with a rule border and a 2px `brand-deep` bottom edge, top corners 4px, sitting on the row's 2px rule. Hover: ice band. Open: `brand-deep` fill, white label. At night the fill is `brand` with `ink-inverse` label.
- **Menus:** a sheet under the overlay shadow, 4px inset padding, rows 12px semibold with a caption beneath; the selected row on `brand-wash`.

### Cover band (signature)
The facility's name on cobalt cloth at the head of the board (`.cover`): a top-lit cobalt fill with a 1px `brand-deep` border, 4px corners and the cover shadow; the name in display weight, the location in `cover-ink-2`, the clock in 34px tabular figures under a 10.5px 0.12em reading head, and the date and signed-in name as further readings. A lower strip on black at 10% carries the "Figures as of" stamp, a lifted-green dot with a one-line reassurance, and the cover button. At night the whole band is `brand-wash` with a 3px `brand` rule along the top and a `brand` border.

### Sign-in cover (signature)
The same cover as a whole page (`.cover-page`) with the 10px navy bound edge on the left: the mark on its label, the product name at 30px to 36px, the facility line, three promises (a 28px outlined white icon box beside a bold title and a caption), and a version line at the foot. The sign-in sheet is a `max-w-sm` panel under the overlay shadow on the ruled ground beside it, first on a phone.

### Dialogs and toasts
A dialog is a sheet under the overlay shadow on the navy scrim, at most 92vh tall, with a 14px semibold title row closed by a feint rule, a scrolling body, and a right-aligned footer of secondary and primary buttons. Confirmation buttons say what will happen, never "OK". A toast is the same sheet at `max-w-sm` in the bottom right (full width on a phone), with a state icon, a bold title, a detail line and optional action. Both enter with `.enter` (220ms rise).

### Motion
One authored moment: when a section tab is chosen the new page turns in (`.page-turn`: 10px rise with fade, 360ms, `cubic-bezier(0.16, 1, 0.3, 1)`), once, on the section wrapper only, never on every element. `.enter` (6px rise, 220ms ease-out) is kept for the dialog and the toast alone. `.tick-in` (scale settle, 460ms, `cubic-bezier(0.22, 1, 0.36, 1)`) is the off-site copy confirmation. Metric underline 180ms; colour and border transitions 120ms ease; the panel 140ms; the `Bar` width 500ms ease-out; the drawer 200ms. Skeleton rows shimmer at 1.5s while data loads. Every one of these is switched off under `prefers-reduced-motion`.

### Named Rules
**The Stamped Word Rule.** A state is a word with a border, in the ink of its hue. A colour-only dot or bar never carries a state on its own; the dot on the cover strip sits beside its sentence.

**The Unrecorded Dash Rule.** A value the database does not hold prints an em dash in `ink-3` with the title "Not recorded". A metric never counts up from zero and never shows a plausible default.

## Do's and Don'ts

### Do:
- **Do** build every structural element from the blue tokens: `canvas`, `surface`, `subtle`, the three rules, the three inks, `brand`, `brand-deep`, `brand-wash`, `spine`.
- **Do** write a colour once through its token so it renders on both sheets; the night values are the same names redefined under `[data-theme='dark']`.
- **Do** put related figures in one `MetricStrip` with `gap-px` on `bg-line-soft`, with a printed head above each figure and one context line beneath.
- **Do** print heads in `label` style (10.5px, 700, 0.06em to 0.08em, uppercase, `brand-deep`) over columns, figures and sections only.
- **Do** set the mark on a white `cover-label` on any blue surface and leave its red and black alone.
- **Do** use `on-blue-ok` and `on-blue-warn` for a state word on navy or cobalt.
- **Do** keep the day palette for anything printed: `.paper` pins it on screen and the print engine pins it for the printer.
- **Do** give every control a name that is its action ("Check in a patient", "Clear samples and go live", "Admit patient"), and every failure a sentence naming the problem and the way out.
- **Do** cap prose at 48rem and keep a figure's context to one truncated line.
- **Do** honour `prefers-reduced-motion` for any new motion, and keep the page turn the only authored moment on the board.

### Don't:
- **Don't** use red, amber or green for identity, emphasis, a department, a chart series or decoration. They are `critical`, `warn` and `ok`, and they report a recorded state.
- **Don't** float figures in individually bordered or shadowed cards, and don't put an icon chip in a metric cell.
- **Don't** put a tracked uppercase label above a heading. Heads go over figures and columns; headings speak for themselves.
- **Don't** render the cover band at night as a cobalt slab; it is the brand wash with a 3px cobalt top rule.
- **Don't** add a ring, halo, glow, zero-offset shadow, gradient text, glass or blur. Depth is the ruling and the hairline panel shadow.
- **Don't** put a coloured `border-left` or `border-right` wider than 1px on a card, list row, callout or alert. The 10px navy bound edge on `.cover-page` and the 3px hover-only rule on a metric cell are the two deliberate exceptions and stay where they are.
- **Don't** load a font, icon or asset from a CDN or any remote URL; the clinic has no internet.
- **Don't** show a plausible default, a simulated reading or a placeholder figure; print the dash.
- **Don't** add a second typeface, a monospace costume or a system display face; hierarchy is Archivo's weight and size.
- **Don't** add a second clock to the board or a second authored motion to the page.
