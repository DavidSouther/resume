# Astrolabe Watch Page — Research

## Topic and Intent

Build an interactive astronomical watch page for this SSG-based personal site. The watch is a geocentric orrery — Earth pinned at 3 o'clock, all eight planets plus the Moon orbiting around it on a logarithmic radial scale — rendered with haute-horology aesthetics: guilloché dial finish, platinum case, a zodiac rim with Tabler stroke-path glyphs, and a controls sheet that exposes animation speed, parallax, finish sliders, body toggles, and the Earth-stationary vs orbital mode switch. The full visual spec lives at `.ailly/prompts/astrolabe`.

The controls panel is built with jiffies CSS components (`@davidsouther/jiffies/dom/components`). The watch face is built with jiffies SVG functions (`@davidsouther/jiffies/dom/svg.ts`). The page is delivered via the existing SSG as `pages/astrolabe/page.ts`.

## Search/Expand

**Astronomical position algorithms.** Jean Meeus, *Astronomical Algorithms* (2nd ed., 1998), is the canonical reference for planetary heliocentric longitude/latitude/radius from VSOP87 (Variations Séculaires des Orbites Planétaires, the standard series expansion used for high-precision solar system positions) truncated series. The `astronomia` npm package (commenthol/astronomia) is a JavaScript port of these algorithms and is available via CDN as a UMD bundle (`https://cdn.jsdelivr.net/npm/astronomia/`). Accuracy is arc-second level for current epoch. Simpler approximations (e.g., the "low-precision formulae" in Meeus chapter 33) give degree-level accuracy and require no CDN — viable as the inline fallback snapshot.

**Build-time ephemeris snapshot.** A build script (`scripts/update-ephemeris-snapshot.ts`) computes planet positions for the build date using the low-precision Meeus formulae and writes the result as a TypeScript literal in `src/lib/astro-snapshot.ts`. The SSG `prebuild` hook calls this script, so `npm run build` always ships a snapshot current to within hours of the build. The snapshot is "close enough" for any date near the build: error grows at roughly planetary mean motion rates (Mercury ~4.09°/day, outer planets fraction of a degree/day). The runtime CDN script overrides the snapshot on load if available.

**Geocentric frame transform.** Earth's heliocentric position is subtracted from each planet's heliocentric position to obtain geocentric ecliptic (the ecliptic plane is the plane of Earth's orbit around the Sun; geocentric ecliptic coordinates place Earth at the origin) coordinates. Rotating that result so Earth sits at angle 270° (3 o'clock) in display space is a single constant rotation applied to all body angles. The Moon's position is geocentric by definition (Meeus, chapter 47); on the dial it orbits the Earth marker rather than the Sun, so its rendered position is offset from Earth's display anchor, not from the dial center.

**Twilight dead zone.** Bodies within roughly 10°–12° of the Sun are lost in solar glare and cannot be observed. The dial represents this as a twilight wedge centered on the Sun's display position — a shaded zone where conjunction lines are unreadable. Conjunctions that fall inside the wedge are flagged rather than rendered as definitive sightlines.

**Logarithmic radial scale.** Mapping heliocentric semi-major axes (0.387 AU Mercury — 30.1 AU Neptune) onto a finite dial radius requires log scaling. `Math.log10(a)` mapped linearly to [r_inner, r_outer] gives readable spacing across all eight planets. The Earth position on this scale is fixed; the log-scale radius of Earth's orbit (1 AU → log10(1) = 0) sets the Earth anchor.

**Guilloché SVG pattern.** A logarithmic spiral in polar form: r = a · e^(b·θ). Two opposite-handed families (b > 0 and b < 0) interleaved produce the crosshatch. In production, the spirals are rendered once to a hidden `<canvas>` at build-time defaults, converted to a data URI, and applied as an SVG `<image>` fill — O(1) repaint cost. In debug mode (`#debug` URL hash), a live guilloché builder runs in the controls panel, re-rendering on slider change. Relief and glint are added via SVG `feTurbulence` + `feDisplacementMap` filters composited at reduced opacity. Beyond decoration, the spiral field doubles as a conjunction graticule: bodies that share a line of sight from Earth fall along a common spiral arm, so conjunctions are directly readable from the dial without a separate overlay.

**Zodiac glyphs.** Tabler Icons has a dedicated "Zodiac" category containing stroke-path icons for all twelve signs (named `zodiac-aries`, `zodiac-taurus`, etc.). Extract the twelve `<symbol>` definitions from the Tabler sprite and inline them in the page's `<defs>` — no CDN required at runtime, no version pinning concern. The spec explicitly calls for stroke-path icons over Unicode because iOS renders the Unicode zodiac code points as color emoji.

**Parallax depth.** CSS `will-change: transform` on SVG `<g>` layers; outer-body groups shift less (they are "far away") on `mousemove` / `DeviceOrientationEvent`. The depth model is purely visual — a small fraction of a pixel per layer per degree of tilt. `DeviceOrientationEvent` requires `requestPermission()` on iOS 13+.

**Animation loop.** A single `requestAnimationFrame` loop drives all motion. Two modes: "Realtime" (1:1 wall-clock) and "Fast" (1 year per minute = 525,960× real-time). The toggle is a two-state button on the page itself, outside the controls panel. Hands are hidden in Fast mode. A simulated wall-clock tracks elapsed virtual time seeded from real ephemeris time at boot.

**Orbital mode.** In geocentric mode (default) the coordinate rotation that pins Earth at 3 o'clock is applied to every body's position. In orbital mode that rotation is removed: Earth moves on its orbit and the Sun remains at the dial center, giving a heliocentric view. The geocentric/orbital toggle in the controls panel switches between these two rotation strategies without changing the underlying position calculations.

**CSS color tokens.** Every body color is a CSS custom property (`--color-sun`, `--color-mercury`, `--color-venus`, `--color-earth`, `--color-moon`, `--color-mars`, `--color-jupiter`, `--color-saturn`, `--color-uranus`, `--color-neptune`). This allows users or themes to override the palette without touching JavaScript. In debug mode, the per-body color pickers write to these properties via `element.style.setProperty`.

**Jiffies SVG module.** `@davidsouther/jiffies/dom/svg.ts` exports factory functions for every SVG element (`svg`, `g`, `circle`, `path`, `pattern`, `radialGradient`, `filter`, `feGaussianBlur`, `feDisplacementMap`, `feTurbulence`, `use`, `defs`, etc.). The watch face is fully expressible without raw `document.createElementNS` calls.

**Jiffies CSS components for the controls panel.** The controls panel is always visible and contains the frame/body controls. In debug mode (`#debug` hash), the guilloché builder and color pickers are additionally shown. Per the `jiffies-css-components` skill:

| Control group | Component | Mode |
| --- | --- | --- |
| Frame mode toggle (geocentric / orbital) | `StaticTabList` | always |
| Body toggles (per-planet on/off) | `FormGroup` with `Switches` | always |
| Guilloché sliders (density, pitch, relief, glint, lacquer) | `Accordion` > `PropertySheet` | debug only |
| Dynamic guilloché builder (live rerender) | `Accordion` > canvas | debug only |
| Color pickers | `PropertySheet` entries with `<input type=color>` | debug only |
| Overall controls container | `Card` or `Panel` with a `header` | always |

The realtime/fast animation toggle is NOT in the controls panel — it is a two-state button rendered directly on the page alongside the watch.

## Falsification/Refine

**Bug or feature?** Pure feature — no existing astrolabe page.

**Off-the-shelf tool?** No existing library renders this particular combination of geocentric framing + log radial scale + guilloché finish + jiffies DOM integration. `astronomia` handles the math layer; the rendering is custom.

**Smallest version that meets intent.** An MVP that still reads as the intended piece:

1. Watch face with all eight planets and the Moon at live positions, log-radial scale, geocentric frame (Earth at 3 o'clock).
2. Sun gold core with glow; Earth date subdial (month + day); hour and minute hands.
3. Zodiac rim with twelve Tabler stroke-path glyphs (inlined from Tabler's Zodiac category); sign occupancy highlight.
4. Guilloché dial prerendered at build-time defaults; static image in production.
5. Realtime / Fast animation toggle on the page (outside the controls panel).
6. Controls panel (always visible): geocentric/orbital switch, body toggles.
7. Controls panel (debug mode `#debug` only): five guilloché sliders with live rerender, per-body color pickers.
8. HTML case/strap wrapper; watch SVG sits inside it.
9. Parallax on desktop (`mousemove`); device-tilt skipped until post-MVP.

Deferred to post-MVP: sign hover/tap info cards, device-tilt parallax, sign-wedge color blending.

**Integration with SSG.** The spec says "one self-contained HTML file." In this project's context that means: no database, no SSR data, all runtime behavior is client-side. The page is generated by `pages/astrolabe/page.ts` as a static HTML file. Two build-time steps precede the SSG:

- `scripts/update-ephemeris-snapshot.ts` — writes `src/lib/astro-snapshot.ts` with positions current to the build date.
- `scripts/render-guilloché.ts` — renders the spiral image at defaults and writes `src/lib/guilloché-image.ts` with the data URI.

Both scripts will be added to the `prebuild` sequence in `package.json` during implementation. The runtime CDN script overrides the ephemeris snapshot if available.

**Fonts.** The spec calls for Cormorant Garamond (display) and DM Mono (labels/readouts). Both are on Google Fonts. `pageHead()` already injects `<link>` tags — the astrolabe page's `head()` function adds two more font `<link>` tags alongside the standard ones.

## Scope

**In scope (MVP + post-MVP as noted):**

- `pages/astrolabe/page.ts` — SSG route, `PageModule` with `head()` + `default()`
- `src/components/astrolabe/` — component tree:
  - `astrolabe.ts` — top-level component (case/strap wrapper, watch, animation toggle, controls)
  - `watch-face.ts` — SVG watch (dial, orbits, bodies, hands, zodiac)
  - `guilloché.ts` — spiral canvas renderer; called at build time and in debug mode live
  - `ephemeris.ts` — geocentric position calculations; falls back to `astro-snapshot.ts`
  - `controls.ts` — jiffies CSS controls panel (always: frame/body; debug: guilloché/colors)
- `src/lib/astro-math.ts` — geocentric frame transform, log-radial mapping, angle utilities
- `src/lib/astro-snapshot.ts` — build-generated planet positions for build date (auto-written)
- `src/lib/guilloché-image.ts` — build-generated guilloché data URI at default settings (auto-written)
- `scripts/update-ephemeris-snapshot.ts` — build-time position calculator, runs in `prebuild`
- `scripts/render-guilloché.ts` — build-time spiral renderer, runs in `prebuild`
- Tabler zodiac icons (twelve `<symbol>` elements) inlined in page `<defs>` — extracted from Tabler Zodiac category
- Google Fonts: Cormorant Garamond + DM Mono added in `head()`
- HTML `<figure>` wrapper with a prebaked static image for the strap/case decoration around the SVG watch element
- Twilight dead zone (shaded wedge near the Sun where conjunctions are unreadable)
- Realtime / Fast toggle button on the page (outside controls panel)

**Out of scope:**

- Physical gear-train / horological analysis (per spec: "leave it out unless asked")
- Standalone `.html` file output separate from the SSG build
- Sign hover/tap info cards (post-MVP)
- Device-tilt parallax (post-MVP)

## Resolved Decisions

| Question | Answer | Source |
| --- | --- | --- |
| SVG element authoring | Use `@davidsouther/jiffies/dom/svg.ts` factory functions | Confirmed present in installed package |
| Controls markup | Use jiffies CSS components (`Card`, `Accordion`, `PropertySheet`, `FormGroup`, `StaticTabList`, `Switches`) | Per `jiffies-css-components` skill + component index.d.ts |
| Zodiac glyphs | Twelve Tabler Zodiac category `<symbol>` elements inlined in `<defs>` — no CDN needed | Tabler confirmed to have Zodiac category; iOS emoji problem with Unicode noted in spec |
| Guilloché in production | Prerender to canvas at build defaults → `guilloché-image.ts` data URI; static in production | Per spec: "Render once to an image so the live repaint stays cheap" |
| Guilloché in debug | Five sliders + live canvas rerender shown only when `#debug` hash is present | User decision |
| Ephemeris fallback | `scripts/update-ephemeris-snapshot.ts` runs at prebuild, writes positions for build date to `src/lib/astro-snapshot.ts` | User decision: "build-time correction, nearby dates close enough" |
| Ephemeris runtime | `astronomia` CDN (UMD via jsDelivr) overrides snapshot on load when available | Per spec: "one optional ephemeris script from a CDN" |
| Animation control | Two-state "Realtime" / "Fast" (1 year/min) toggle button on the page, outside controls panel | User decision |
| Fonts | Google Fonts — Cormorant Garamond + DM Mono; injected in page `head()` | Per spec |
| SSG integration | `pages/astrolabe/page.ts` following existing `PageModule` pattern | Matches existing pages structure |
| Case / strap | HTML `<figure>` wrapper with a prebaked static image for the strap/case decoration | User decision: "HTML wrapper makes more sense; could be a prebaked image" |
| Color theming | Every body color is a CSS custom property (`--color-sun`, `--color-mercury`, etc.); debug mode color pickers write to these properties via `setProperty` | Per spec: "Every color is a token the user can change" |

## Sources

[1] J. Meeus, *Astronomical Algorithms*, 2nd ed. Richmond, VA: Willmann-Bell, 1998.

[2] commenthol, "astronomia," GitHub, 2024. Available: https://github.com/commenthol/astronomia

[3] Tabler Icons, "Tabler Icons SVG," MIT License, 2024. Available: https://github.com/tabler/tabler-icons

[4] D. Souther, "jiffies-css-components skill," jiffies monorepo, 2025. Available: https://github.com/jefri/jiffies/blob/main/skills/jiffies-css-components/SKILL.md

[5] D. Souther, "@davidsouther/jiffies," npm, 2026. Version ^2026.24.4 per package.json.

[6] Astrolabe visual spec, `.ailly/prompts/astrolabe`, this repository.
