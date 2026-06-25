# Jiffies FCC reference — building the Astrolabe dial FCC tree

Source of truth: the **installed** package `@davidsouther/jiffies` v2026.25.0 under
`node_modules/@davidsouther/jiffies/lib/esm/dom/`. Every behaviour below was read
from the shipped `.js` (runtime) and `.d.ts` (types), not from docs or memory.
File anchors:

- `dom/fc.js` + `fc.d.ts` — `FCC`, `FC`, `applyUpdate`, `getFCC`, `attach`, `State`.
- `dom/dom.js` + `dom.d.ts` — `update`, `reconcileChildren`, `normalizeArguments`,
  `isUnit`, `scanAllUnits`, `isNested`, `propsFromElement`, `patchNode`, `CLEAR`.
- `dom/hydrate.js` + `hydrate.d.ts` — `start`, `installCaptureStub`, `readPayload`,
  `hydrateRoot`, `captureStubSource`.
- `dom/svg.d.ts` — every SVG builder (`g`, `circle`, `line`, `path`, `text`, `stop`,
  `linearGradient`, `radialGradient`, `ellipse`, `defs`, `clipPath`, `polyline`, …).
- `dom/html.d.ts` — every HTML builder (`div`, `span`, `button`, `svg` is in *svg*).

Import paths used in `src` (the repo idiom, already in `zodiac.ts`/`planets.ts`):
`import { g, circle, line, path, text, stop, linearGradient } from "@davidsouther/jiffies/dom/svg.ts";`
and `import { FCC, getFCC } from "@davidsouther/jiffies/dom/fc.ts";`. The `~/` alias is
typecheck-only — these are package specifiers so they are fine; for *intra-src* value
imports use relative `.ts` paths.

---

## 1. `FCC(name, boundary, render)` — signature and what `render` receives/returns

```ts
function FCC<Props extends object, S extends object = object>(
  name: string,
  boundary: BoundaryFactory,            // () => Element  — builds the root element
  render: RenderFn<Props, S>,
  _isCustom?: boolean,                  // internal; FC passes true. Leave unset.
): FCComponentCtor<Props, S>;           // (attrs?, ...children) => FCComponent

type RenderFn<Props, State> = (
  el: FCComponent<Props, State>,        // the live boundary element (carries [State])
  attrs: Attrs<Props>,                  // MERGED attrs (see §3) — your props live here
  children: DenormChildren[],           // the *caller-passed* children list (raw)
) => Element | Element[];               // the boundary's children to reconcile
```

**`render` returns children, never the boundary.** The boundary is built once by
`boundary()`; `render`'s return value is reconciled *into* that boundary as its
child list (see `applyUpdate` lines 31-32 of `fc.js`: `[render(...)]` then
`reconcileChildren(el, rendered.flat())`). Returning a single `Element` or an
`Element[]` both work — the result is wrapped in `[...]` and `.flat()`-ed.

`boundary` is the namespace selector. For an SVG component pass an SVG builder such
as `g` (from `dom/svg.ts`); for HTML pass `div`. The builder is called with no
arguments — `boundary()` — so it returns an empty element in the right namespace.
The `data-fc="<name>"` marker is applied by the ctor (`fc.js` line 109), so the
boundary element is automatically an opaque unit (`isUnit`, §5).

What the ctor does on construction (`fc.js` lines 102-114):
1. `element = boundary()` — build the root in the correct namespace.
2. `element.setAttribute("data-fc", name)` — mark the unit boundary.
3. `attach(element, update)` — wire the shared per-definition `update` onto it.
4. `component.update(attrs, ...children)` — run the **first** render immediately.
5. return the element (insert it directly into a parent's child list).

So **constructing an FCC renders it once eagerly.** A "render-once static FCC" is
just an FCC you construct and never call `.update()` on again.

The shared `update` is registered in a module-level `Map` keyed by `name`
(`registry.set(name, update)`, `fc.js` line 100) — this is what `getFCC(name)` reads
and what hydration re-wires (§6). **`name` must be unique per definition**; two FCCs
with the same name clobber each other in the registry. Use distinct names per
subsystem (e.g. `astro-zodiac`, `astro-discs`, `astro-clock`).

---

## 2. `el.update(attrs, ...children)` — the reconcile algorithm

`FCComponent.update(attrs?, ...children)` calls `applyUpdate(this, render, attrs,
children)` (`fc.js` lines 95-98). `applyUpdate` (`fc.js` lines 15-33):

1. `normalizeArguments(attrs, children)` — if the first arg is not an attrs object
   (it has a `nodeType`, i.e. it is a Node/string/`CLEAR`), it is treated as the
   first *child* instead and attrs defaults to `{}`. Children are `.flat()`-ed and
   conditional values dropped: `null`, `undefined`, and `false` are removed; **`0`
   and `""` are kept** as legitimate text nodes (`dom.js` lines 40-44).
2. **Attrs MERGE, children REPLACE.** `inputs.attrs = { ...inputs.attrs, ...attrs }`
   — every `update` call merges its attrs onto the accumulated set, so you can push
   a partial slice each frame. Children only replace when `children.length > 0`;
   an `update(attrs)` with no children **keeps the previous children**. To clear
   children pass the `CLEAR` sentinel as the sole child (`fc.js` lines 21-26).
3. `update(el, inputs.attrs, [])` — apply the merged attrs to the boundary element
   itself (no children here).
4. `render(el, inputs.attrs, inputs.children)` — re-run render with merged attrs.
5. `reconcileChildren(el, rendered.flat())` — reconcile the returned children.

`reconcileChildren` (`dom.js` lines 130-187) is keyed by **node identity first, then
`nodeName`**:
- Strings become text nodes (`createTextNode`).
- A returned node already mounted (same object) is kept in place.
- An unclaimed mounted element is **reused** for a desired element of the same
  `nodeName` via `patchNode` (attribute/event diff in place, `dom.js` 238-267) — so
  if your `render` rebuilds fresh `path(...)` elements every frame, the engine still
  patches the *existing* DOM `<path>` rather than replacing it, as long as the child
  count and `nodeName` sequence are stable. **This is why the frame test can assert
  `divs[i].getAttribute("d") === scene.zodiac[i].dividerD`**: same 12 `<path>`s,
  patched in place.
- Anything mounted but not desired is removed; desired-but-unmounted is inserted.
- `patchNode` does **not** descend into a unit boundary (`if (isUnit(kept)) return;`,
  `dom.js` 264-265) — see §5.

`update` on the element (`dom.js` 68-126) is what applies a single attrs object to
one element; the FCC's `applyUpdate` calls it for the boundary, and the SVG/HTML
builders call it for their own elements via `up`. Same mechanics throughout.

---

## 3. Exact attr keys: events, class, style, attributes, text

From `update` in `dom.js` (lines 68-126) and `DomAttrs` in `dom.d.ts` (9-16):

- **events**: `events: { pointerdown: fn, pointerup: fn, … }`. Each value is added
  via `addEventListener` and tracked in a per-element `[Events]` map so re-updates
  *replace* the handler (no stacking — `setListener`, `dom.js` 54-60). `null` removes
  a tracked listener; `undefined` leaves it. Keys are `keyof HTMLElementEventMap`.
  Setting any event also toggles `data-hydrate` on the element (`dom.js` 79).
  **This is the only sanctioned event wiring** — never `el.addEventListener` on a
  descendant (the no-raw-DOM guard forbids it).
- **class**: `class: "active spoke"` or `class: ["active", "spoke"]`. A token
  prefixed `!` is **removed**: `class: "!active"` removes `active` (`dom.js` 99-109).
  Tokens are *added/removed*, not set wholesale — class is incremental, so to toggle
  a flag push both forms across frames: `class: active ? "active" : "!active"`.
- **style**: `style: "fill:red"` (a string sets `cssText`) **or** `style: { fill:
  "red", transformOrigin: "0 0" }` (an object assigns each camelCase property)
  (`dom.js` 81-91). For the dial host sizing decision (`sizeDial`) this is the
  FCC-routed alternative to `el.style.width = …`.
- **plain attributes**: any other key is `setAttribute(k, String(v))`. Falsy `v`
  (`0`, `""`, `false`, `null`, `undefined`) → `removeAttribute(k)`; `v === true` →
  `setAttribute(k, k)` (boolean attr) (`dom.js` 111-119). **Caution:** because falsy
  removes, an attribute whose legitimate value is `0` is dropped — pass numeric-zero
  payloads as strings (`"0"`) if they must persist. SVG payload strings (`d`,
  `transform`, `offset`, `cx`, …) are passed verbatim as values.
- **text**: pass a string as a child (`circle(...)` → no; `text({}, scene.simClock)`
  → yes). The string becomes a text node via reconcile. **Never** `el.textContent =`.
  To update clock text every frame: `clockEl.update({}, scene.simClock)` (children
  replace because `length > 0`).

`Attrs<E,S>` (`dom.d.ts` 17-19) maps every element property to `string|number|
boolean` plus the `S` extra-attrs and `DomAttrs`. So builders are loosely typed —
arbitrary SVG attribute keys are accepted as strings.

---

## 4. Builders (svg.ts / html.ts) — same mechanics as FCC

Every builder has signature `(attrs?, ...children) => Element` and runs the same
`normalizeArguments` + `update` pipeline. A builder element also gets an
`el.update` method grafted on (`dom.js` 124), so you can build with a builder and
later `el.update(...)` it exactly like an FCC element — **but a builder element is
NOT a unit** (no `data-fc`), so a parent reconcile *will* descend into and patch it.
Use builders for the *leaf shapes inside* an FCC's render; use FCCs for the subtree
boundaries the controller retains.

Available SVG builders (full list, `svg.d.ts`): `a animate animateMotion
animateTransform circle clipPath defs desc ellipse feBlend … feTurbulence filter
foreignObject g image line linearGradient marker mask metadata mpath path pattern
polygon polyline radialGradient rect script set stop style svg svgswitch symbol text
textPath title tspan use view`. Note `svgswitch` (not `switch`) and `htmlvar` (not
`var`) are the renamed reserved-word builders.

`stop` accepts `SVGStopAttrs`: `{ "stop-color", "stop-opacity", offset }`
(`svg.d.ts` 57-61) — exactly what the gradient-stop hole needs (§7c).

---

## 5. A child FCC boundary is opaque to a parent reconcile

`isUnit(el)` is `customElements.get(el.localName) != null || el.hasAttribute(
"data-fc")` (`dom.js` 193-195). Two places stop at a unit:

- `patchNode` returns *before* `reconcileChildren(kept, …)` when `isUnit(kept)`
  (`dom.js` 264-265). So when a parent FCC's render emits a child FCC element and
  reconciles, the engine patches the child's *boundary attributes/events* but
  **never touches the child's internal subtree**.
- `scanUnits` in hydrate (`hydrate.js` 65-80) does not descend into matched units.

**This is the architectural guarantee the design relies on:** `astrolabeView`
retains handles to its *immediate* child FCCs (zodiac, discs, hands, clocks, …), and
each child owns its own subtree. The root never holds a ref deeper than its
immediate children, and a root reconcile cannot reach into a child's leaves — so the
"no refs past immediate children" boundary is engine-enforced, not convention.

Practical pattern: build each child FCC **once** at view construction (the ctor
renders it once and returns the element), append the elements into the SVG groups,
keep the returned handles, and each frame call `handle.update(slice)`. The root
itself need not be an FCC — `astrolabeView(svg)` can hold a plain record of child
handles and fan `scene` slices out by hand. (Alternative B — one monolithic root
FCC over the whole Scene — was rejected in the design for per-frame cost.)

---

## 6. `getFCC` + the module registry, and `hydrate.start()` vs the current rebuild

**Registry.** Non-custom FCCs register their shared `update` under `name` at
*definition* time (`registry.set(name, update)`, `fc.js` 100). `getFCC(name)`
(`fc.js` 57-59) returns that `update` or `undefined`. The registry is how a
server-rendered `data-fc` element — which the platform never "upgrades" the way it
upgrades a custom element — gets its behaviour back on the client.

**`hydrate.start(root?)`** (`hydrate.js` 94-121), the flow the design wants
`client.ts` to adopt:
1. `units = scanAllUnits(root ?? document.body)` — depth-first, document-order walk
   that **descends into** units so the index order matches the server's payload
   build (`dom.js` 202-215).
2. `payload = readPayload()` — `JSON.parse` of `#__hydration` script `textContent`,
   or `[]` if absent (`hydrate.js` 53-58).
3. For each unit, skip if it is `isNested` (a parent's re-render will rebuild it).
4. For a `data-fc` unit: `update = getFCC(fc)`; if found, `attach(el, update)`,
   `el.replaceChildren()` (clear server children), `el.update(payload[index])`
   (re-render from the server-emitted props), then `drainQueue(el)` (replay events
   the capture stub queued before the bundle loaded). For a custom-element unit it
   waits on `customElements.whenDefined`.

**`installCaptureStub()`** (`hydrate.js` 158-189) installs capture-phase
`document.addEventListener` for `click/input/change/submit/keydown` that queue
pre-hydration events into `window.__hydrateQueue`. The SSG build inlines the
equivalent `captureStubSource` IIFE (`hydrate.js` 9-38) so events fire-and-queue
before the client bundle arrives; `start()`'s `drainQueue` replays them.
NB: the stub captures only those five event types — **`pointerdown`/`pointermove`/
`pointerup`** (the drag interactions) are NOT queued pre-hydration; that is fine for
the dial because dragging before the bundle loads is not expected, but do not rely on
queued pointer events.

**Today's `client.ts` (the thing being replaced)** uses `document.getElementById`
to fetch `#dial`/`#zodiac`/`#discs`, then `buildZodiac`/`buildPlanets`/`initTexture`
imperatively `appendChild`/`setAttribute` a fresh subtree onto those server nodes —
a *rebuild*, not a hydrate, and full of forbidden raw-DOM calls. The FCC path
replaces this: the server emits `data-fc` boundaries, the client calls
`hydrate.start()` which re-wires each from `getFCC` and re-renders from payload, and
`astrolabeView(svg)` collects the child handles to drive each frame. `client.ts`
remains out of the Feature-1 no-raw-DOM scan (its `window`/`visualViewport`
listeners and `<svg>` *host* sizing are the permitted page-lifecycle exceptions —
guard EXCLUDE set is `{client.ts, controls.ts}`).

`hydrateRoot(mount, render)` (`hydrate.js` 219-223) is the *other* entry: render the
whole tree from one render fn and graft onto kept server nodes via `startHydrate`
(reads props from attributes, not from a payload). Use `start()` (payload + registry)
when boundaries are independent units — which is the dial's shape.

---

## 7. Minimal working snippets (all valid inside `<svg>`)

All three use `g` as the boundary so the `data-fc` marker lands on an SVG `<g>`,
which is valid SVG content (an HTML custom element would not be).

### (a) Render-once static FCC

Construct it, append it, never `.update()` it again. Texture (120 lines + 160
sparkles), bezel, defs/gradients are these.

```ts
import { FCC } from "@davidsouther/jiffies/dom/fc.ts";
import { g, line } from "@davidsouther/jiffies/dom/svg.ts";
import { GUILLOCHE_LINES } from "../../lib/astrolabe/texture.ts"; // static geometry in lib

const Texture = FCC<{}>("astro-texture", g, () =>
  GUILLOCHE_LINES.map((l) =>
    line({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, class: "texture-line" }),
  ),
);

// at mount: build once (the ctor renders eagerly), append, then forget it.
const texture = Texture({ id: "texture" });   // <g data-fc="astro-texture" id="texture">…</g>
svg.append(texture);                            // .append is a non-mutation-guard insert; or
                                                // emit it as a child of a parent FCC's render.
```

### (b) Dynamic FCC whose `update(slice)` sets `transform`/`d` and toggles a class

The zodiac/divider subsystem. Render reads merged attrs and rebuilds leaf shapes;
the engine patches the existing 12 `<path>`s in place by `nodeName` (§2), so the
frame test's `divs[i].getAttribute("d")` assertion holds.

```ts
import { FCC } from "@davidsouther/jiffies/dom/fc.ts";
import { g, path } from "@davidsouther/jiffies/dom/svg.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";

// One disc FCC: boundary <g class="disc-<key>">, leaf <circle>/glyph inside.
const Disc = FCC<{ key: string; transform: string }>("astro-disc", g,
  (el, attrs) => {
    el.update?.({ class: `disc-${attrs.key}`, transform: attrs.transform });
    return [/* leaf circle/glyph built from lib geometry */];
  },
);
// Per frame: discHandle.update({ transform: scene.bodies[key].transform });
// (attrs merge, so `key` set once at construction persists.)

// The 12 zodiac dividers, each a <path class="zdiv"> inside <g id="zdivs">.
const Dividers = FCC<{ zodiac: Scene["zodiac"] }>("astro-zdivs",
  () => g({ id: "zdivs" }),
  (_el, attrs) =>
    attrs.zodiac.map((z, i) =>
      // class is incremental: push "active" or "!active" each frame to toggle.
      path({ class: z.active ? "zdiv active" : "zdiv !active", d: z.dividerD }),
    ),
);
// Per frame: zdivsHandle.update({ zodiac: scene.zodiac });
```

Notes that matter for parity:
- A `transform`/`d` whose value is `""` would be *removed* (falsy, §3). If a frame
  must emit "no transform", emit the identity string, not `""`.
- For the boundary's *own* attributes (the `<g class="disc-mars">`'s `transform`),
  set them via the boundary's `el.update(...)` inside render (as above) or pass them
  as attrs to the FCC ctor/`update` — the FCC applies its attrs to the boundary
  (`applyUpdate` step 3). The frame test reads `.disc-mars`'s `transform`, so put the
  body transform on the `disc-<key>` boundary element.

### (c) Gradient-stop children built from a data array (the simulate "color" hole)

`simulate` emits `zodiac[i].gradientStops: { offset, color }[]` (colors resolved via
the injected `color()` resolver — DOM-free). The view turns each into a `stop()`
child; **never** `appendChild` a stop.

```ts
import { FCC } from "@davidsouther/jiffies/dom/fc.ts";
import { defs, linearGradient, stop } from "@davidsouther/jiffies/dom/svg.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";

const Gradients = FCC<{ zodiac: Scene["zodiac"] }>("astro-zgrads",
  () => defs(),
  (_el, attrs) =>
    attrs.zodiac.map((z, i) =>
      linearGradient(
        { id: `zgrad${i}`, gradientUnits: "userSpaceOnUse",
          x1: z.gradX1, y1: z.gradY1, x2: z.gradX2, y2: z.gradY2 },
        // children: one <stop> per data entry, colors already resolved in lib.
        ...z.gradientStops.map((s) =>
          stop({ offset: s.offset, "stop-color": s.color }),
        ),
      ),
    ),
);
// Per frame (or once if static): zgradsHandle.update({ zodiac: scene.zodiac });
```

The spread `...z.gradientStops.map(stop)` is the data-to-children idiom: a builder's
children are just its trailing args, so a mapped array spreads straight in. The same
shape covers the guilloche line list (`scene.guilloche.lines.map((l) => path({ d:
l.d, opacity: l.opacity }))`) and the spokes.

---

## 8. Checklist mapped to the no-raw-dom guard

The guard (`no-raw-dom.feature.test.ts`) forbids, per dial module, regexes for:
`.appendChild( .insertBefore( .removeChild( .replaceChild( .createElement(NS)?(
.setAttribute( .removeAttribute( .toggleAttribute( .classList .innerHTML .outerHTML
.textContent= .dataset. .style` plus element `addEventListener` (after stripping
`window|document|globalThis|visualViewport` receivers). Sanctioned replacements:

| Forbidden raw call            | FCC / builder replacement                         |
|-------------------------------|---------------------------------------------------|
| `appendChild`/`insertBefore`  | return the node in `render`; reconcile inserts it |
| `removeChild`                 | omit from render output (or `CLEAR` child)        |
| `createElement(NS)`           | `g()/circle()/path()/stop()/…` builders           |
| `setAttribute(k,v)`           | attr key in builder/`update`: `{ [k]: v }`        |
| `removeAttribute(k)`          | falsy attr value `{ [k]: false }` (removes)       |
| `classList.add/remove/toggle` | `class` attr; `"x"` adds, `"!x"` removes          |
| `innerHTML`/`outerHTML`       | builder child tree (never an HTML string)         |
| `textContent =`               | string child: `el.update({}, text)`               |
| `dataset.x =`                 | `data-x` attr: `{ "data-x": v }`                  |
| `style`/`setProperty`         | `style` attr (string cssText or object)           |
| element `addEventListener`    | `events: { pointerdown: fn }`                     |

Permitted reads/non-element APIs (do NOT route these): `getBoundingClientRect`,
`getComputedStyle` (backs the injected `color()` resolver), `window.Astronomy`,
`setPointerCapture`/`releasePointerCapture` *inside `events:` handlers*,
`requestAnimationFrame`, `localStorage`, `matchMedia`, `performance.now`,
`Date.now`, and `window`/`document`/`globalThis`/`visualViewport` `addEventListener`.

Note `Element.append`/`replaceChildren`/`prepend` are not in the FORBIDDEN regex
list — but prefer reconcile-driven children to keep the architectural seam clean;
the only sanctioned host-level insert is wiring the built FCC roots into the SVG at
mount.
