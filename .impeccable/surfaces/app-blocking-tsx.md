---
version: 1
slug: "app-blocking-tsx"
primary_target: "app/blocking.tsx"
related_targets: []
---

# Focus & app pauses

Scope: the Focus & app pauses screen (app/blocking.tsx). Mode: operate. Visitor task: check what is active right now and adjust one setting; first-time setup is secondary. Must not feel strict or punishing. Inherits the app's established world (dark ground, LilitaOne display, warm accent, purple brain).

## Direction contract

THESIS: The screen answers "what will happen if I open Reels now?" before it shows a single control. It refuses the category default of six equal cards and a wall of switches.

OWN-WORLD: Near-black ground #0B0B08, raised surfaces #17160F / #29271F, warm accent #FFD18E for live state and selection, muted #B4B3AA for summaries; LilitaOne for the screen title and the status headline, system sans for rows. Purple brain as the status panel's companion. Rows are flat, divided by hairlines, no nested cards.

STORY: The visitor reads the status headline (the coral attention state only when pauses cannot run; heads-ups such as Usage Access stay a quiet note with a fix under "Pauses are on") (on or off, what pauses, when next), scans one summary per setting, taps the one to change, edits it in place, and leaves. A missing app choice is called out in the status panel, kindly.

FIRST VIEWPORT: Back button and "Focus" title; a status panel with the brain left, a LilitaOne headline ("Pauses are on" / "Pauses are off"), one plain sentence of what happens next, and the main switch; then the summary list starts: Apps, Daily limit, Focus times, each row a two-line item with the current value set under its title and a chevron at the trailing edge (changed from a trailing value during the build: trailing values wrapped, e.g. "Reels & Shorts", and broke at larger font sizes; Material two-line list items hold any length). Signature move: the status sentence rewrites itself live as settings change.

FORM: Status panel + expandable summary rows, position 1 on the ranked list (dealt as candidate 1), seed key 38e67795.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
