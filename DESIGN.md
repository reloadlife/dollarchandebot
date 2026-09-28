---
name: DollarChande
description: A night price board for free-market toman rates.
colors:
  led: "oklch(0.84 0.16 72)"
  led-ghost: "oklch(0.84 0.16 72 / 22%)"
  brand: "oklch(0.78 0.17 55)"
  brand-ink: "oklch(0.18 0.04 45)"
  ground: "oklch(0.145 0.025 45)"
  housing: "oklch(0.185 0.028 42)"
  well: "oklch(0.12 0.025 45)"
  ink: "oklch(0.96 0.02 85)"
  dim: "oklch(0.8 0.05 75)"
  line: "oklch(0.78 0.12 55 / 22%)"
  day-ground: "oklch(0.97 0.012 85)"
  day-ink: "oklch(0.22 0.04 45)"
  day-led: "oklch(0.46 0.16 42)"
  day-brand: "oklch(0.52 0.16 42)"
typography:
  display:
    fontFamily: "Vazirmatn, IRANSansX, ui-sans-serif, sans-serif"
    fontSize: "2.65rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Vazirmatn, IRANSansX, ui-sans-serif, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Vazirmatn, IRANSansX, ui-sans-serif, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "normal"
  label:
    fontFamily: "Vazirmatn, IRANSansX, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  surface: "16px"
spacing:
  header: "64px"
  page: "16px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.surface}"
    padding: "0 16px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.housing}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.surface}"
    padding: "0 16px"
    height: "44px"
  totem-housing:
    backgroundColor: "{colors.housing}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  totem-well:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "28px 24px"
---

# Design System: DollarChande

## Overview

**Creative North Star: "The night price board"**

DollarChande looks like the amber board a shop owner already stops to read on the street. The number is the object. Persian is set in Vazirmatn. The digits on the board stay western, the way a real LED price is built. One amber carries the lit segments and the action. Everything else is a warm near-black housing.

Daylight is the same board in the sun: the wall bleaches, the digits become dark amber ink, and the accent stays the same hue. The previous pale graphite page is the rejected look.

**Key Characteristics:**

- One amber, used for lit segments and the primary action.
- Unlit segments stay visible.
- 16px corners on the board, the sections, and the actions.
- Persian reading order. Prices on the board run left to right.
- The live rate is the proof. No invented customers, counts, or testimonials.

## Colors

The night scene is the brand. Light mode is the same materials under daylight, swapped on `prefers-color-scheme`.

### Primary

- **Board amber** (`oklch(0.84 0.16 72)`): lit segments at night.
- **Action amber** (`oklch(0.78 0.17 55)`): primary buttons, links, focus, selection. Ink on the button is `oklch(0.18 0.04 45)`.

### Neutral

- **Night ground** (`oklch(0.145 0.025 45)`): page.
- **Housing** (`oklch(0.185 0.028 42)`): raised board frame and section panels.
- **Well** (`oklch(0.12 0.025 45)`): the recessed face the digits sit in.
- **Warm ink** (`oklch(0.96 0.02 85)`): text on the night ground.
- **Dim amber-gray** (`oklch(0.8 0.05 75)`): labels inside the well.
- **Hairline** (`oklch(0.78 0.12 55 / 22%)`): borders.
- **Day ground** (`oklch(0.97 0.012 85)`), **day ink** (`oklch(0.22 0.04 45)`), **day digits** (`oklch(0.46 0.16 42)`), **day action** (`oklch(0.52 0.16 42)`).

**The One Amber Rule.** Segments, focus, selection, and the primary action share one hue. Status red and green exist for errors and for the rate board's up/down marks. They do not become a second brand color.

## Typography

**Display Font:** Vazirmatn (IRANSansX, then the system sans)
**Body Font:** Vazirmatn
**Digits:** the seven-segment board, not the text face. A screen reader hears the toman amount.

**Character:** One Persian face for everything a person reads. The board is a drawn digit, not a font costume.

### Hierarchy

- **Display** (600, 2.65rem, 1.25): the landing headline. Two lines at most.
- **Headline** (600, 1.875rem, 1.35): section titles.
- **Body** (400, 16.5px, 1.8): explanations. Keep a section sentence near 48 characters wide.
- **Label** (400, 0.875rem): board captions, buttons, navigation.

**The Western Digit Rule.** Prices on the board use 0-9. Persian digits stay in the caption and the clock.

## Layout

The public site is RTL. The landing headline and its two actions sit on the start side. The board occupies the other half and aligns to the top. Below `1024px` the headline, the actions, then the board stack in that order so the actions stay in the first screen.

The page column is `72rem`. The header is one line, `64px` tall. Section padding is `64px`. More space sits above a heading than between a heading and its sentence.

## Elevation & Depth

Depth is the board's housing: a soft warm shadow under the frame, and an inset shadow inside the well. Flat panels elsewhere use a hairline, not a second shadow.

### Shadow Vocabulary

- **Housing** (`box-shadow: 0 22px 40px -26px oklch(0.1 0.04 45)`): the price board only.
- **Well** (`box-shadow: inset 0 14px 22px -16px oklch(0.05 0.02 40)`): the recessed digit face. In daylight the inset is `oklch(0.45 0.06 50 / 40%)`.

**The No Halo Rule.** Lit segments are a flat amber fill. They do not wear an outer glow.

## Shapes

Every surface, button, and the board uses a 16px radius. Buttons are not pills. Grouped prices are separated by a gap, not a dot, so the gap cannot be read as a decimal point.

## Components

### Buttons

- **Shape:** 16px radius, 44px tall, 16px horizontal padding.
- **Primary:** action amber with dark ink. Hover brightens. Press scales to 0.98.
- **Quiet:** housing fill, hairline, warm ink. Used for the second action.
- **Focus:** 2px amber ring, 3px outside the control.

### Cards / Containers

- **Corner Style:** 16px.
- **Background:** housing, with the well one step darker inside the board.
- **Shadow Strategy:** housing shadow on the board only.
- **Border:** 1px hairline.
- **Internal Padding:** 16px on the frame, 28px 24px inside the well.

### Navigation

One row, 64px. Wordmark on the start side. Links are dim until hover. On a narrow screen the row scrolls instead of wrapping onto a second line.

### Price board

USD is the large readout. Tether and 18k gold sit under a hairline at a smaller size. Empty state is a dim full set of eights. When the rate arrives, only the segment color changes, over 180ms. A failure says the rate did not arrive and asks for a refresh. The caption carries the Tehran clock of that quote.

## Do's and Don'ts

### Do:

- **Do** keep unlit segments visible.
- **Do** show the live quote as the proof on the landing.
- **Do** use one 16px radius for the board, panels, and actions.
- **Do** preserve Persian copy, toman as the unit, and western digits on the board.

### Don't:

- **Don't** put an eyebrow or a section number above a heading.
- **Don't** lay the offer out as three equal feature cards.
- **Don't** add an outer glow to the segments.
- **Don't** invent testimonials, customer logos, or download counts.
