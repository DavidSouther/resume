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
    padding-block: var(--size-base, 0.5rem);
    background: var(--color-surface, canvas);
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

  /* ---------------------------------------------------------------- Browse */

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--size-base, 0.5rem);
  }

  /* Flip-card mechanics only — the surface look (background, border, radius,
   * shadow, padding) comes from jiffies-css's Card component
   * (article:not([role])), which these rules deliberately do not redeclare. */
  .flash-tile {
    perspective: 60rem;
    min-height: 7rem;

    &[hidden] {
      display: none;
    }
    &.flipped .flash-tile-inner {
      transform: rotateY(180deg);
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
  .flash-face {
    position: absolute;
    inset: 0;
    /* Card sets its own margin for a document-flow card; pinned absolutely
     * here for the flip stack, it doesn't want one. */
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

  .review-card {
    perspective: 80rem;
    width: 100%;
    max-width: 32rem;
    min-height: 14rem;
    margin-inline: auto;

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
  .review-face {
    position: absolute;
    inset: 0;
    margin: 0;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    backface-visibility: hidden;
    font-size: 1.05em;
  }
  .review-back {
    transform: rotateY(180deg);
  }

  .review-progress {
    max-width: 32rem;
    margin-inline: auto;
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
