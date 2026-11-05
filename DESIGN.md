---
name: Kudocoin
description: A playful coin for teams.
colors:
  canvas: "#f7f4ec"
  surface: "#fffdf8"
  raised: "#ffffff"
  hover: "#f0ebdf"
  line: "#ddd5c3"
  ink: "#1f1c15"
  muted: "#555044"
  subtle: "#6b6555"
  coin: "#f2b632"
  on-coin: "#1f1c15"
  coin-text: "#8a5a00"
  coin-soft: "#fcefcc"
  alert-text: "#b42318"
  done-text: "#2e6b3a"
---

# Design

A game among colleagues: warm, light, a little proud. Paper and ink, with the coin's gold as the one loud color.

## Color

- **Canvas and surface** are warm paper. Cards sit on the canvas with a thin line and a soft shadow.
- **Gold is the coin.** It fills the main button, marks the top three places and the allowance line. It is never a page background.
- **Ink on gold, always.** White on gold does not read; the deeper `coin-text` is the gold for text on paper.
- **Dark mode** follows the system. The tokens change in `brand/theme.css`; components never do.
- Never a hex in a component. A new color is a token here and in `brand/theme.css` first.

## Type

The system's own fonts: no font files to ship or license. Headings use the rounded face where the system has one (`font-display`). Numbers in lists and balances are tabular, so columns line up.

## Shape

- Controls are at least 44 px tall: they are tapped on phones.
- Radius: 10 px for controls, 16 px for cards, round for pills and avatars.
- One column on phones. The organization's page puts the leaderboard and the give form side by side from 1024 px.

## Words

- Every text comes from `t()` in every language (`docs/decisions/languages.md`).
- What people typed (names, reasons, the coin's name, the prize) is shown as typed.
- A refusal says what to do: "You can only give 2 more today", not "Error 422".
- A destructive action asks in place, with confirm focused: Enter confirms, Esc leaves it.

## The top bar

Sticky, with a solid background: phones blur the top of a page that has none.
