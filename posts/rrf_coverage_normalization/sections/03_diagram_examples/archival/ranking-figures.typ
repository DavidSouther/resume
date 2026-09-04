#import "@preview/lilaq:0.6.0" as lq

// This module owns the fixed analytic scenarios and their score mathematics.
#let rrf-score(ranks, k) = ranks.fold(0.0, (total, rank) => total + 1.0 / (k + rank))
#let coverage-division-score(ranks, k) = rrf-score(ranks, k) / ranks.len()
#let rbc-score(ranks, phi) = ranks.fold(0.0, (total, rank) => total + (1 - phi) * calc.pow(phi, rank - 1))
#let singleton-normalized-log-multiplier(coverage, b) = calc.ln(coverage + b) / calc.ln(1 + b)
#let logn-isr-coverage-factor(coverage, sigma) = calc.ln(coverage + sigma)

#let ink = rgb("#1f2937")
#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let red = rgb("#b91c1c")
#let green = rgb("#15803d")
#let pale-blue = rgb("#dbeafe")
#let pale-orange = rgb("#ffedd5")

#let rank-grid = range(1, 21).map(float)

#let boundary-plot(title, difference) = lq.diagram(
  width: 100%,
  height: 1.55cm,
  title: title,
  xlabel: [document A rank],
  ylabel: [document B rank],
  xlim: (1, 20),
  ylim: (1, 20),
  margin: 0%,
  xaxis: (ticks: (1, 10, 20)),
  yaxis: (ticks: (1, 10, 20)),
  grid: (stroke: 0.25pt + luma(210)),
  // The signed field is S(A) - S(B); the zero contour is the equal-score boundary.
  lq.contour(rank-grid, rank-grid, difference, levels: (-0.04, 0.0, 0.04), fill: true, map: (pale-orange, luma(248), pale-blue)),
  lq.contour(rank-grid, rank-grid, difference, levels: (0.0,), stroke: 1.1pt + ink),
)

#let rank-support-panel() = block[
  #text(weight: "bold")[A. Rank/support decision boundaries] \
  #text(size: 8pt)[Document A has one rank; document B has two equal-rank supports. Each panel plots the signed difference $S(A)-S(B)$ over integer display ranks 1--20. The dark zero contour is equal score: blue side, A ranks first; orange side, B ranks first.]
  #v(2pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 5pt,
    boundary-plot([RRF, $k=1$], (a, b) => rrf-score((a,), 1) - rrf-score((b, b), 1)),
    boundary-plot([RRF, $k=5$], (a, b) => rrf-score((a,), 5) - rrf-score((b, b), 5)),
    boundary-plot([coverage division, $k=20$], (a, b) => coverage-division-score((a,), 20) - coverage-division-score((b, b), 20)),
    boundary-plot([RBC, $phi=0.5$], (a, b) => rbc-score((a,), 0.5) - rbc-score((b, b), 0.5)),
    boundary-plot([RBC, $phi=0.8$], (a, b) => rbc-score((a,), 0.8) - rbc-score((b, b), 0.8)),
  )
]

#let added-support-panel() = {
  let k = 20
  let current-mean = 1.0 / (k + 5)
  let terms = lq.linspace(0.005, 0.07, num: 20)
  block[
    #text(weight: "bold")[B. Added-support threshold] \
    #text(size: 8pt)[With $k=20$, a document starts with mean reciprocal term $1/(20+5)=0.04$. Coverage division rises only when the added reciprocal term exceeds the current mean; it is unchanged at the zero line and lower below it. For additive RRF, $Delta "RRF"$ equals the added reciprocal term.]
    #v(2pt)
    #grid(
      columns: (1fr, 1fr),
      gutter: 5pt,
      lq.diagram(
        width: 100%,
        height: 2.55cm,
        title: [coverage division, $k=20$],
        xlabel: [added reciprocal term],
        ylabel: [score change],
        xlim: (0.005, 0.07),
        ylim: (-0.04, 0.04),
        margin: 0%,
        grid: (stroke: 0.25pt + luma(210)),
        lq.plot(terms, terms.map(term => (term - current-mean) / 2), stroke: 1.3pt + blue, mark: none),
        lq.line((0.005, 0), (0.07, 0), stroke: 0.9pt + ink),
        lq.line((current-mean, -0.04), (current-mean, 0.04), stroke: (paint: orange, dash: "dashed")),
      ),
      lq.diagram(
        width: 100%,
        height: 2.55cm,
        title: [additive RRF, $k=20$],
        xlabel: [added reciprocal term],
        ylabel: [$Delta "RRF"$],
        xlim: (0.005, 0.07),
        ylim: (0, 0.07),
        margin: 0%,
        grid: (stroke: 0.25pt + luma(210)),
        lq.plot(terms, terms, stroke: 1.3pt + green, mark: none),
        lq.line((0.005, 0), (0.07, 0), stroke: 0.9pt + ink),
      ),
    )
    #align(center)[#text(size: 8pt)[below current mean: lower score · at current mean: unchanged · above current mean: higher score. In contrast, every positive added term increases additive RRF.]]
  ]
}

#let coverage-policy-panel() = {
  let coverage = range(1, 7).map(float)
  block[
    #text(weight: "bold")[C. Coverage policy] \
    #text(size: 8pt)[Singleton-normalized logarithmic RRF multipliers map integer coverage directly; no panel-max normalization is applied.]
    #v(2pt)
    #lq.diagram(
      width: 100%,
      height: 2.15cm,
      xlabel: [coverage $n$],
      ylabel: [singleton-normalized multiplier],
      xlim: (1, 6),
      ylim: (0.9, 5.0),
      margin: 0%,
      grid: (stroke: 0.25pt + luma(210)),
      legend: (position: top + right),
      lq.plot(coverage, coverage.map(n => singleton-normalized-log-multiplier(n, 0.5)), label: [$b=0.5$], color: orange, mark: none),
      lq.plot(coverage, coverage.map(n => singleton-normalized-log-multiplier(n, 1)), label: [$b=1$ default], color: blue, mark: none),
      lq.plot(coverage, coverage.map(n => singleton-normalized-log-multiplier(n, 4)), label: [$b=4$], color: green, mark: none),
    )
    #v(2pt)
    #grid(
      columns: (1fr, 1fr),
      gutter: 5pt,
      lq.diagram(
        width: 100%,
        height: 1.8cm,
        title: [logN-ISR, $sigma=0$],
        xlabel: [coverage $n$],
        ylabel: [factor],
        xlim: (1, 6),
        ylim: (0, 1.9),
        margin: 0%,
        xaxis: (ticks: (1, 3, 6)),
        grid: (stroke: 0.25pt + luma(210)),
        lq.plot(coverage, coverage.map(n => logn-isr-coverage-factor(n, 0)), stroke: 1.2pt + orange, mark: none),
      ),
      lq.diagram(
        width: 100%,
        height: 1.8cm,
        title: [logN-ISR, $sigma=0.01$],
        xlabel: [coverage $n$],
        ylabel: [factor],
        xlim: (1, 6),
        ylim: (0, 1.9),
        margin: 0%,
        xaxis: (ticks: (1, 3, 6)),
        grid: (stroke: 0.25pt + luma(210)),
        lq.plot(coverage, coverage.map(n => logn-isr-coverage-factor(n, 0.01)), stroke: 1.2pt + blue, mark: none),
      ),
    )
    #align(center)[#text(size: 8pt)[logN-ISR factor: $sigma=0$ gives $ln(1)=0$ at a singleton; $sigma=0.01$ repairs it with $ln(1.01)>0$. A positive global B rescales scores but cannot reorder a fixed family.]]
  ]
}

#let ranking-figure() = block(width: 100%)[
  #set text(fill: ink)
  #rank-support-panel()
  #v(5pt)
  #grid(columns: (1fr, 1fr), gutter: 9pt, added-support-panel(), coverage-policy-panel())
]
