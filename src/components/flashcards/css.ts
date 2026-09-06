// Page-scoped styles for /flashcards. This is the bespoke remainder ONLY —
// buttons, selects, checkboxes, cards, panels, alerts, progress bars, form
// groups, and the tab strip all come from jiffies-css's own components (see
// app.ts/browse.ts/review.ts, and the jiffies-css-components /
// jiffies-css-semantic-html skills at github.com/jefri/jiffies and
// github.com/jefri/jiffies-css). What's left here is exactly what jiffies-css
// has no opinion on: the flip-card 3D transform, the auto-fill card grid, and
// the sticky toolbar.
//
// Layered as `component` so the jiffies-css v2 bundle's own layers (reset,
// layout, content) still win where they should, while these rules still beat
// the bundle's default element styling — see src/global.css's `@layer` order
// comment for why the layer name matters.
//
// Written with native CSS nesting (broadly supported by the browsers this
// site targets) rather than flattened selectors — this string ships to the
// browser verbatim (an inline <style>, not run through a build-time CSS
// processor), so native nesting is exactly what parses here.
export const FLASHCARDS_CSS = /* css */ `
@layer component {
  /* flex-wrap + justify-content: space-between on exactly two children (the
   * filters group and the status group — see app.ts) gives two clean states
   * and nothing in between: both groups fit, so space-between pushes them to
   * opposite ends of one line; or they don't, so the second wraps to its own
   * line where space-between is a no-op (nothing to space against) and it
   * simply sits at the start, aligned under the first. Letting all four
   * controls wrap as flat, independent flex children instead produces a
   * different, unplanned line count at every in-between width. */
  .flashcards-toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    flex-wrap: wrap;
    justify-content: space-between;
    column-gap: var(--size-medium, 1rem);
    row-gap: var(--size-small, 0.25rem);
    padding-block: var(--size-medium, 1rem);
    background: var(--color-surface, canvas);
    border-bottom: 1px solid var(--color-outline-variant, currentcolor);
  }
  .flashcards-filters {
    flex: 1 1 22rem;
    flex-wrap: wrap;
    gap: var(--size-small, 0.25rem) var(--size-base, 0.5rem);
    min-width: 0;
  }
  .flashcards-search {
    flex: 1 1 12rem;
    min-width: 0;
  }
  .flashcards-deck-select {
    flex: 1 1 10rem;
  }
  .flashcards-status {
    flex: 0 1 auto;
    flex-wrap: wrap;
    gap: var(--size-small, 0.25rem) var(--size-base, 0.5rem);
  }
  /* The bare Switch() <label> in the toolbar: keep its box and "Due only"
   * text on one line rather than letting flex-wrap break between them. */
  .flashcards-status label {
    display: inline-flex;
    align-items: center;
    gap: var(--size-small, 0.25rem);
    white-space: nowrap;
  }
  .flashcards-summary {
    white-space: nowrap;
  }

  /*
   * jiffies-css v2.0.0 ships Alert()'s JS (role + data-variant) but not yet a
   * matching component/alert.css — [role="status"]/[role="alert"] currently
   * render as bare, unstyled elements. This is a minimal bridge using the
   * same token vocabulary the rest of the bundle uses, so it looks
   * reasonable meanwhile and becomes redundant (not conflicting) once
   * jiffies-css ships real alert styling. Deliberately no \`display\` here —
   * these are also [hidden]-toggled by client.ts, and declaring display
   * would risk the same layer-vs-attribute fight documented below for
   * .review-grades.
   */
  [role="status"][data-variant], [role="alert"][data-variant] {
    padding: var(--size-medium, 1rem) var(--size-large, 1.5rem);
    border-radius: var(--border-radius-container, 0.5rem);
    background: var(--card-background-color, canvas);
  }
  [role="status"][data-variant="info"] {
    border: 1px solid var(--color-primary, currentcolor);
  }
  [role="status"][data-variant="success"] {
    border: 1px solid var(--color-success, currentcolor);
  }

  /* Same gap as the Alert bridge above, for Chip(): jiffies-css emits
   * small[data-variant] for it but ships no matching component/chip.css yet,
   * so it renders as bare, unstyled text — which is why the toolbar's card
   * count previously read as a stray fragment next to the due-only switch
   * rather than a self-contained readout. */
  small[data-variant] {
    display: inline-flex;
    align-items: center;
    padding: 0.25em 0.6em;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
  }
  small[data-variant="neutral"] {
    background: var(--color-surface-variant, #e2e1ec);
    color: var(--color-on-surface-variant, currentcolor);
  }

  /* ---------------------------------------------------------------- Browse */

  /* jiffies-css's heading scale is tuned for reading a document (this site's
   * blog/CV surfaces), not for a dense card index: at its default size a
   * group heading runs 3x the base font. Browse is an Operate surface —
   * scanning many groups at once — so both levels are reined in from that
   * display scale rather than inheriting it. The group heading (h2) keeps
   * the site's serif for identity, sized down to a tight label. The section
   * heading (h3) drops to the body sans as a compact caption-style label:
   * there are far more of these per screen than there are groups. */
  .browse-group > header {
    padding-block: var(--size-small, 0.25rem);
  }
  .browse-group > header h2 {
    margin-block: 0;
    font-size: 1.25rem;
  }
  .browse-section h3 {
    margin-block: var(--size-base, 0.5rem) var(--size-small, 0.25rem);
    font-family: var(--brand-body-font-family, sans-serif);
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-on-surface-variant, currentcolor);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--size-base, 0.5rem);
  }

  /* Flip-card mechanics only — the surface look (background, border, radius,
   * shadow, padding) comes from jiffies-css's Card component
   * (article:not([role])), which these rules deliberately do not redeclare. */
  .flash-tile {
    position: relative;
    perspective: 60rem;
    min-height: 7rem;

    &[hidden] {
      display: none;
    }
    &.flipped .flash-tile-inner {
      transform: rotateY(180deg);
    }

    /* The due indicator client.ts computes into data-due: a small accent dot,
     * not a label, so it reads at a glance across a whole grid without
     * competing with the card content. Decorative only — "due only"/the
     * toolbar summary carry the same information as text. */
    &[data-due="true"]::after {
      content: "";
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      z-index: 1;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--color-primary, currentcolor);
      pointer-events: none;
    }
  }
  .flash-tile-inner {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
    cursor: pointer;
    transition: transform 0.5s;
    transform-style: preserve-3d;
  }
  /* Qualified with the .flash-tile ancestor (not just ".flash-face" alone):
   * jiffies-css's card selector — :is(article,section):not([role]):is(...) —
   * carries three type selectors on top of its one class-equivalent, so a
   * bare single-class override loses that specificity fight and the card's
   * own vertical margin survives, pushing each face off the flip stack's
   * inset:0 alignment (visible as a gap above/below the face once anything
   * else, like the due dot, is positioned relative to the tile's own box).
   * Two classes here outrank their one-class-plus-type-selectors total. */
  .flash-tile .flash-face {
    position: absolute;
    inset: 0;
    margin: 0;
    overflow: auto;
    backface-visibility: hidden;
    font-size: 0.92em;

    code, pre {
      font-family: var(--mono, ui-monospace, monospace);
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }
  .flash-back {
    transform: rotateY(180deg);
  }

  /* ---------------------------------------------------------------- Review */

  /* The scope picker, progress bar, card, hint, and grade row all read as one
   * task, so they share a single centered column instead of the picker
   * running full-bleed above a narrower card below it. */
  .review-view {
    display: flex;
    flex-direction: column;
    gap: var(--size-base, 0.5rem);
    max-width: 32rem;
    margin-inline: auto;
  }

  .review-card {
    perspective: 80rem;
    width: 100%;
    min-height: 14rem;

    &.flipped .review-card-inner {
      transform: rotateY(180deg);
    }
  }
  .review-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
    transition: transform 0.4s;
    transform-style: preserve-3d;
  }
  /* Same specificity fight as .flash-tile .flash-face above, same fix. */
  .review-card .review-face {
    position: absolute;
    inset: 0;
    margin: 0;
    overflow-y: auto;
    display: flex;
    /* flex-start, not center: a face taller than the card scrolls, and
     * centering an overflowing box clips equally off both ends — the start
     * of a long answer would be cut off above the visible frame with no
     * hint there was more, worst on the phone widths this card runs
     * narrowest on. Starting at the top means a truncated face always reads
     * as "scroll for more," never as "this is the whole answer." */
    align-items: flex-start;
    justify-content: center;
    text-align: center;
    backface-visibility: hidden;
    padding-block: var(--size-base, 0.5rem);
    font-size: 1.05em;

    /* Card()'s <main> is the face's only flex child, so justify-content:
     * center above shrinks it to its content width and centers that box —
     * fine for a short prose question, but a <pre> block then centers each
     * *line* of code within that shrunk box too, staggering every line to a
     * different indent. Stretching main to the full face width first makes
     * that centering a no-op for prose (still visually centered — it now
     * spans the whole card) while giving pre a real full-width box to be
     * genuinely left-aligned in, not just centered. */
    & > main {
      width: 100%;
    }
    /* Same treatment as .flash-face's identical rule above — review reuses
     * the exact same rendered field HTML (see client.ts's renderedFace), so
     * a long line wraps instead of forcing the card wider than its frame. */
    pre {
      text-align: left;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    code, pre {
      font-family: var(--mono, ui-monospace, monospace);
    }
  }
  .review-back {
    transform: rotateY(180deg);
  }

  @media (max-width: 32rem) {
    .review-card {
      min-height: 20rem;
    }
  }

  .review-progress {
    width: 100%;
  }

  /* Grade buttons: Rating's four grades (fsrs.ts) aren't interchangeable —
   * Again means "I got this wrong," Easy means "trivial." A single teal for
   * all four reads as one undifferentiated row and makes the retry action
   * feel identical to a pass, so each grade takes the same tonal-container
   * treatment jiffies-css's own .secondary uses (fill from a role's
   * -container token, label from its on-<role>-container pair), keyed off the
   * data-grade the Rating enum already sets — see buttons.css for the
   * --_button-fill / --_button-label contract these override. Good keeps
   * the button component's own default primary fill: it's the modal,
   * "as expected" grade. */
  .review-grades button[data-grade="1"] {
    --_button-fill: var(--color-error-container, #f8d7da);
    --_button-label: var(--color-on-error-container, #842029);
  }
  .review-grades button[data-grade="2"] {
    --_button-fill: var(--color-warning-container, #fff3cd);
    --_button-label: var(--color-on-warning-container, #664d03);
  }
  .review-grades button[data-grade="4"] {
    --_button-fill: var(--color-success-container, #d1e7dd);
    --_button-label: var(--color-on-success-container, #0f5132);
  }

  @media (prefers-reduced-motion: reduce) {
    .flash-tile-inner, .review-card-inner {
      transition: none;
    }
  }
}

/*
 * .review-grades also carries jiffies-css's sanctioned ".flex.row" utility
 * classes (@layer utility) for its layout. Cascade LAYERS take priority over
 * specificity when comparing declarations in different layers — @layer order
 * is fns, reset, layout, content, component, utility, user, theme (see
 * src/global.css's own comment on this), so a rule in @layer component
 * (above) can never beat ".flex"'s "display: flex" in @layer utility,
 * however specific it's written. @layer user — the same escape hatch
 * global.css itself documents and uses — sits after utility, so this one
 * rule lives there instead of alongside the rest of this file's styles.
 */
@layer user {
  .review-grades[hidden] {
    display: none;
  }
}
`;
