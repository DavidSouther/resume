#import "@preview/lilaq:0.6.0" as lq

// Figure 1, the kernel-curve atlas.
//
// This module owns the score families' kernel mathematics. Every formula is
// transcribed from sections/03_mathematical_formulation.md, and every plotted
// value is computed once into `atlas-data`, from which the diagrams are built.
// Nothing here draws a number it did not export.

// --- Domain service functions ----------------------------------------------

// S_RRF term: one retriever occurrence at rank r contributes 1 / (k + r).
#let rrf-kernel(r, k) = 1.0 / (k + r)
// RBC rank kernel q_phi(r) = (1 - phi) phi^(r - 1), for 0 < phi < 1.
#let rbc-kernel(r, phi) = (1 - phi) * calc.pow(phi, r - 1)
// Q_ISR term: 1 / r^2. ISR's outer coverage factor n lives in the coverage panel.
#let isr-kernel(r) = 1.0 / (r * r)
// Singleton-normalized logarithmic coverage multiplier, B = 1 / ln(1 + b).
#let log-multiplier(n, b) = calc.ln(n + b) / calc.ln(1 + b)

// --- Held constants --------------------------------------------------------

#let k-tuned = 20.0
#let k-canonical = 60.0
#let rbc-phi = 0.8
#let b-shift = 1.0
#let weights = (0.1, 1.0, 0.1)
#let retriever-count = 3

// The shared five-document, three-retriever fixture. Ranks are one-based.
#let fixture = (
  P: (1,),
  T: (2, 2),
  C: (5, 5, 5),
  M: (3, 10, 10),
  L: (20, 20, 20),
)

#let distinct-fixture-ranks = fixture.values().flatten().dedup().sorted()

// --- Sampling --------------------------------------------------------------

// One shared rank grid for all four curves, so any two are comparable at any
// sampled rank. The union with the fixture's own ranks guarantees a sample
// lands exactly on each guide, including the r = 5 ISR / RRF k=20 crossing.
// Keep the chain on one expression: a method call after a line break ends the
// binding and is parsed as markup instead, silently leaving the grid unsorted.
#let sweep = lq.linspace(1, 20, num: 80).map(float)
#let rank-samples = (sweep + distinct-fixture-ranks.map(float)).dedup().sorted()

#let sample-curve(kernel) = rank-samples.map(r => (r, kernel(r)))

// Marks are derived from the fixture, never listed by hand: one per distinct
// (document, rank) group, carrying how many retrievers placed it there.
#let fixture-marks = {
  let marks = ()
  for (doc, occurrences) in fixture {
    for r in occurrences.dedup() {
      marks.push((
        doc: doc,
        rank: float(r),
        multiplicity: occurrences.filter(other => other == r).len(),
        y: rrf-kernel(float(r), k-canonical),
      ))
    }
  }
  marks.sorted(key: mark => mark.rank)
}

// Coverage responses are normalized to their own single-supporter value, so
// each begins at exactly 1 and the four are comparable as growth shapes.
#let coverage-levels = (1.0, 2.0, 3.0, 4.0, 5.0)
#let normalized-growth(growth) = coverage-levels.map(n => (n, growth(n) / growth(1.0)))

// --- The value object ------------------------------------------------------

#let atlas-data = (
  fixture: fixture,
  params: (
    k-tuned: k-tuned,
    k-canonical: k-canonical,
    phi: rbc-phi,
    b: b-shift,
    weights: weights,
    retriever-count: retriever-count,
  ),
  rank-panel: (
    xscale: "log",
    yscale: "log",
    xlim: (1.0, 20.0),
    curves: (
      rrf-k20: sample-curve(r => rrf-kernel(r, k-tuned)),
      rrf-k60: sample-curve(r => rrf-kernel(r, k-canonical)),
      rbc: sample-curve(r => rbc-kernel(r, rbc-phi)),
      isr: sample-curve(isr-kernel),
      log-rrf-n5: sample-curve(r => log-multiplier(5.0, b-shift) * rrf-kernel(r, k-canonical)),
    ),
    reference-curve: "rrf-k60",
    marks: fixture-marks,
  ),
  coverage-panel: (
    xscale: "linear",
    yscale: "linear",
    series: (
      // Plain RRF grows as n/(k+r) and RBC as n q_phi(r); normalized, both n.
      linear: normalized-growth(n => n),
      // Coverage division remains 1/(k+r) for every n >= 1.
      coverage-division: normalized-growth(_ => 1.0),
      // ISR grows as n^2/r^2.
      isr: normalized-growth(n => n * n),
      // Logarithmic RRF grows as B n ln(n+b)/(k+r).
      log-rrf: normalized-growth(n => n * log-multiplier(n, b-shift)),
    ),
    multiplier: coverage-levels.map(n => (n, log-multiplier(n, b-shift))),
    doc-coverage: fixture.pairs().map(((doc, occurrences)) => (
      doc: doc,
      n: occurrences.len(),
    )),
  ),
  weight-panel: (retrievers: (1, 2, 3), weights: weights),
  // Every family reaches exactly one drawn series. Seven entries, because
  // base RRF is drawn at both of its constants.
  families: (
    rrf-k20: (panel: "rank-panel", series: "rrf-k20"),
    rrf-k60: (panel: "rank-panel", series: "rrf-k60"),
    rbc: (panel: "rank-panel", series: "rbc"),
    isr: (panel: "rank-panel", series: "isr"),
    coverage-division: (panel: "coverage-panel", series: "coverage-division"),
    logarithmic-rrf: (panel: "coverage-panel", series: "log-rrf"),
    // Weighted RRF is drawn by the bars alone. The manuscript derives its
    // n w/(k+r) growth only at a constant w, which (0.1, 1.0, 0.1) is not.
    weighted-rrf: (panel: "weight-panel", series: "weights"),
  ),
  figure-fn: "kernel-curve-atlas-figure()",
)

// --- Source rules from the design's Data contract ---------------------------

#let rank-panel = atlas-data.at("rank-panel")
#let coverage-panel = atlas-data.at("coverage-panel")
#let weight-panel = atlas-data.at("weight-panel")

// Keyed, because two exported collections hold coordinate pairs and two hold
// dictionaries. A bare .at(0) on a mark raises "expected string, found integer".
#let xs(series, key: 0) = series.map(point => point.at(key))
#let ys(series, key: 1) = series.map(point => point.at(key))

// --- Ink -------------------------------------------------------------------

#let ink = rgb("#1f2937")
#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let red = rgb("#b91c1c")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let guide-stroke = 0.4pt + luma(205)

// Stable per-document ink. One document keeps one colour across all three
// panels: the rank-panel marks and tokens, the coverage tick tokens, and the
// declaration card.
#let doc-colors = (P: blue, T: orange, C: green, M: violet, L: red)

// --- Column 1: the rank-policy panel ----------------------------------------

// Ticks must be (value, content) pairs. A bare numeric array leaves lilaq's
// log formatter in place, which renders rank 2 as 10^0.301.
#let rank-ticks = distinct-fixture-ranks.map(r => (float(r), [#r]))

// A token prints its multiplicity only when more than one retriever placed the
// document at that rank. The numeral is per-rank multiplicity, not coverage.
#let mark-label(mark) = {
  let name = text(weight: "bold", size: 7pt, fill: doc-colors.at(mark.doc))[#mark.doc]
  if mark.multiplicity > 1 {
    name + text(size: 7pt, fill: doc-colors.at(mark.doc))[#sym.times#mark.multiplicity]
  } else { name }
}

#let rank-diagram = lq.diagram(
  width: 0% + 7.9cm,
  height: 0% + 9.55cm,
  xlabel: text(size: 7pt)[rank $r$ of one occurrence (log)],
  ylabel: text(size: 7pt)[rank kernel, per occurrence (log)],
  xlim: rank-panel.xlim,
  ylim: (0.002, 2.6),
  xaxis: (scale: rank-panel.xscale, ticks: rank-ticks, subticks: none),
  yaxis: (scale: rank-panel.yscale),
  grid: (stroke: guide-stroke),
  legend: (position: bottom + left, fill: white, stroke: 0.4pt + luma(180), dy: -2pt),
  // The x ticks are exactly the fixture ranks, so the grid already draws one
  // guide per rank and any curve can be read at a mark.
  lq.plot(
    xs(rank-panel.curves.rrf-k60),
    ys(rank-panel.curves.rrf-k60),
    label: text(size: 7pt)[RRF $k=60$ (canonical): $1 / (k + r)$],
    stroke: 1.2pt + blue,
    mark: none,
  ),
  lq.plot(
    xs(rank-panel.curves.rrf-k20),
    ys(rank-panel.curves.rrf-k20),
    label: text(size: 7pt)[RRF $k=20$ (tuned)],
    stroke: (paint: blue, thickness: 1.2pt, dash: "dashed"),
    mark: none,
  ),
  lq.plot(
    xs(rank-panel.curves.rbc),
    ys(rank-panel.curves.rbc),
    label: text(size: 7pt)[RBC $phi=0.8$: $(1-phi) phi^(r-1)$],
    stroke: 1.2pt + red,
    mark: none,
  ),
  lq.plot(
    xs(rank-panel.curves.isr),
    ys(rank-panel.curves.isr),
    label: text(size: 7pt)[ISR: $1 / r^2$],
    stroke: 1.2pt + green,
    mark: none,
  ),
  lq.plot(
    xs(rank-panel.curves.log-rrf-n5),
    ys(rank-panel.curves.log-rrf-n5),
    label: text(size: 7pt)[log RRF, $|R_d|=5$, $b=1$],
    stroke: 1.2pt + violet,
    mark: none,
  ),
  // Marks sit on the declared reference curve, never on a document total.
  lq.scatter(
    xs(rank-panel.marks, key: "rank"),
    ys(rank-panel.marks, key: "y"),
    mark: "o",
    size: 6pt,
    color: rank-panel.marks.map(mark => doc-colors.at(mark.doc)),
  ),
  // Document tokens ride a header band above every curve. ISR peaks at 1.0 and
  // the panel tops out at 2.6, so this row is clear of all four kernels; it is
  // a layout constant for annotations, never an exported coordinate.
  ..rank-panel.marks.map(mark => lq.place(mark.rank, 1.75, mark-label(mark))),
)

// --- Column 2: the coverage-policy panels ------------------------------------

// n(d) = |I_d| is a bounded cardinality, so the marks are the data and the
// joining line is a reading aid, not a sampled curve.
//
// The document tokens ride in the tick labels themselves. That makes them
// axis annotations rather than data marks, which is the honest encoding: a
// token placed inside the data area would imply a claim about whichever
// series it landed near. It also aligns them to the ticks for free.
#let doc-token(name) = text(weight: "bold", size: 7pt, fill: doc-colors.at(name), name)

#let coverage-ticks = coverage-levels.map(n => {
  let names = coverage-panel.doc-coverage.filter(entry => entry.n == int(n)).map(entry => entry.doc)
  let tokens = names.map(doc-token).join(h(1.2pt))
  (n, [#calc.round(n) #linebreak() #tokens])
})

// Series are labelled at their right-hand endpoints, in reserved margin space
// past n = 3. A legend box inside this panel occludes the curves it explains.
#let coverage-series-label(key, body, color) = lq.place(
  5.12,
  coverage-panel.series.at(key).last().at(1),
  align: left,
  pad(left: 3pt, box(width: 1.85cm, text(size: 7pt, fill: color)[#body])),
)

#let coverage-diagram = lq.diagram(
  width: 0% + 4.7cm,
  height: 0% + 5.8cm,
  xlabel: text(size: 7pt)[coverage $n$],
  ylabel: text(size: 7pt)[growth, relative to $n = 1$],
  xlim: (0.85, 5.45),
  ylim: (0, 26),
  xaxis: (ticks: coverage-ticks, subticks: none),
  yaxis: (ticks: ((1, [1]), (5, [5]), (10, [10]), (25, [25])), subticks: none),
  grid: (stroke: guide-stroke),
  lq.plot(
    xs(coverage-panel.series.isr),
    ys(coverage-panel.series.isr),
    color: green,
    stroke: 1.1pt + green,
    mark: "o",
    mark-size: 3.5pt,
  ),
  lq.plot(
    xs(coverage-panel.series.log-rrf),
    ys(coverage-panel.series.log-rrf),
    color: violet,
    stroke: 1.1pt + violet,
    mark: "o",
    mark-size: 3.5pt,
  ),
  lq.plot(
    xs(coverage-panel.series.linear),
    ys(coverage-panel.series.linear),
    color: blue,
    stroke: 1.1pt + blue,
    mark: "o",
    mark-size: 3.5pt,
  ),
  lq.plot(
    xs(coverage-panel.series.coverage-division),
    ys(coverage-panel.series.coverage-division),
    color: orange,
    stroke: 1.1pt + orange,
    mark: "o",
    mark-size: 3.5pt,
  ),
  coverage-series-label("isr", [ISR: $n^2$], green),
  coverage-series-label("log-rrf", [log RRF:#linebreak()$n ln(n+1) \/ ln 2$], violet),
  coverage-series-label("linear", [RRF, RBC: $n$], blue),
  coverage-series-label("coverage-division", [coverage#linebreak()division: $1$], orange),
)

// Prompt D commissions this curve by name. It is concave and sits below the
// linear line, which is the diminishing-increment property the growth panel
// hides, because there the same family plots above the linear line.
#let multiplier-diagram = lq.diagram(
  width: 0% + 4.7cm,
  height: 0% + 3.45cm,
  xlabel: text(size: 7pt)[coverage $n$],
  ylabel: text(size: 7pt)[$ln(n+b) \/ ln(1+b)$],
  xlim: (0.85, 5.45),
  ylim: (0.85, 2.8),
  xaxis: (ticks: coverage-levels.map(n => (n, [#calc.round(n)])), subticks: none),
  yaxis: (ticks: ((1, [1]), (1.5, [1.5]), (2, [2])), subticks: none),
  grid: (stroke: guide-stroke),
  lq.plot(
    xs(coverage-panel.multiplier),
    ys(coverage-panel.multiplier),
    color: violet,
    stroke: 1.1pt + violet,
    mark: "o",
    mark-size: 3.5pt,
  ),
  lq.place(5.12, coverage-panel.multiplier.last().at(1), align: left, pad(left: 3pt, box(width: 1.85cm, text(size: 7pt, fill: violet)[
    log RRF, $b=1$
  ]))),
)

// --- Column 3: retriever weights and the declaration card --------------------

#let weight-diagram = lq.diagram(
  width: 0% + 4.6cm,
  height: 0% + 3.6cm,
  xlabel: text(size: 7pt)[retriever],
  ylabel: text(size: 7pt)[weight $w_i$],
  ylim: (0, 1.15),
  xaxis: (ticks: weight-panel.retrievers.map(i => (i, [#i])), subticks: none),
  yaxis: (ticks: ((0, [0]), (0.5, [0.5]), (1, [1])), subticks: none),
  grid: (stroke: guide-stroke),
  lq.bar(weight-panel.retrievers, weight-panel.weights, fill: orange, width: 45%),
)

#let declaration-card = block(width: 100%, height: 5.65cm, inset: (x: 1pt), {
  set par(justify: false, leading: 0.38em)
  set text(size: 7pt)
  text(size: 7.5pt, weight: "bold")[Fixture, held parameters, and caveats]
  v(1.5pt)
  table(
    columns: (auto, auto, auto, auto, auto, 1fr),
    inset: (x: 2pt, y: 0.9pt),
    align: (left, right, right, right, right, left),
    stroke: none,
    table.header([doc], [$r_1$], [$r_2$], [$r_3$], [$n$], []),
    table.hline(stroke: 0.4pt),
    ..fixture
      .pairs()
      .zip(("one head placement", "two strong placements", "broad steady agreement", "one strong, two weak", "broad but late agreement"))
      .map((((doc, occurrences), role)) => (
        text(fill: doc-colors.at(doc), weight: "bold")[#doc],
        ..range(retriever-count).map(i => if i < occurrences.len() [#occurrences.at(i)] else [#sym.dash.en]),
        [#occurrences.len()],
        text(size: 7pt, fill: luma(90))[#role],
      ))
      .flatten(),
  )
  v(1.5pt)
  table(
    columns: (auto, 1fr),
    inset: (x: 2pt, y: 0.9pt),
    align: (left, left),
    stroke: none,
    text(weight: "bold")[$k$], [$60$ canonical, $20$ tuned comparison],
    text(weight: "bold")[$phi$], [$0.8$, an analytic choice],
    text(weight: "bold")[$b$, $B$], [$1$ and $1 \/ ln 2$, singleton-normalized],
    text(weight: "bold")[$w_i$], [$(0.1, 1.0, 0.1)$, an analytic choice],
    text(weight: "bold")[token], [letter, then $times$ the retrievers placing it at that rank],
  )
  v(1.5pt)
  text(size: 7pt, style: "italic")[
    The families share no common score scale: a curve's height is its own
    kernel, not a comparable score. Weighted RRF appears only as its weight
    vector, because its linear coverage growth needs a constant $w$ that
    $(0.1, 1.0, 0.1)$ does not supply.
  ]
})

// --- Assembly ----------------------------------------------------------------

#let kernel-curve-atlas-figure-6b() = block(width: 100%, {
  set text(fill: ink)
  grid(
    columns: (7.9cm, 4.7cm, 4.6cm),
    column-gutter: 0.45cm,
    align: top,
    rank-diagram,
    grid(rows: auto, row-gutter: 0.3cm, coverage-diagram, multiplier-diagram),
    grid(rows: auto, row-gutter: 0.3cm, weight-diagram, declaration-card),
  )
})
