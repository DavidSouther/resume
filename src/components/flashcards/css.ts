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
  .review-card .review-face {
    position: absolute;
    inset: 0;
    margin: 0;
    overflow-y: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    text-align: center;
    backface-visibility: hidden;
    padding-block: var(--size-base, 0.5rem);
    font-size: 1.05em;

    & > main {
      width: 100%;
    }
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
