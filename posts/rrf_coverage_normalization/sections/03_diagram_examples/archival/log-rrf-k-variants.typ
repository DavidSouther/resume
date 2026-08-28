#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")

// A has one supporter at rank a. B has five supporters, each at rank r.
// r is the tie depth: B wins whenever its actual rank is smaller than r.
#let multiplier(b) = calc.ln(5 + b) / calc.ln(1 + b)
#let tie-depth(k, a, b) = (5 * multiplier(b) - 1) * k + 5 * multiplier(b) * a
#let k-values = lq.linspace(0, 200, num: 80)

#let b-panel = lq.diagram(
  width: 7.1cm, height: 5.8cm,
  xlabel: [$k$], ylabel: [five-support tie depth $r$],
  xlim: (0, 200), ylim: (0, 3600),
  xaxis: (ticks: (0, 20, 60, 100, 200)), yaxis: (ticks: (0, 1000, 2000, 3000)),
  grid: (stroke: 0.25pt + luma(220)), legend: (position: top + left),
  ..((1.0, blue), (2.0, orange), (3.0, green)).map(entry => {
    let b = entry.at(0)
    let color = entry.at(1)
    lq.plot(k-values, k-values.map(k => tie-depth(k, 1.0, b)), label: [$b=#b$], color: color, stroke: 1.35pt + color, mark: none)
  }),
)

#let baseline-panel = lq.diagram(
  width: 7.1cm, height: 5.8cm,
  xlabel: [$k$], ylabel: [five-support tie depth $r$],
  xlim: (0, 200), ylim: (0, 2700),
  xaxis: (ticks: (0, 20, 60, 100, 200)), yaxis: (ticks: (0, 500, 1500, 2500)),
  grid: (stroke: 0.25pt + luma(220)), legend: (position: top + left),
  ..((1.0, blue), (2.0, orange), (3.0, green), (5.0, violet)).map(entry => {
    let a = entry.at(0)
    let color = entry.at(1)
    lq.plot(k-values, k-values.map(k => tie-depth(k, a, 1.0)), label: [singleton at rank #a], color: color, stroke: 1.35pt + color, mark: none)
  }),
)

#let log-rrf-k-variants-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Five-support logarithmic-RRF variants]
  #text(size: 7pt)[Each curve gives the deepest equal rank for five supporters that still ties a one-support comparison document. Any smaller rank beats that document.]
  #v(3pt)
  #grid(columns: (7.1cm, 7.1cm), column-gutter: 0.55cm, b-panel, baseline-panel)
  #v(2pt)
  #align(center, text(size: 7pt)[Left holds the singleton at rank 1 and varies $b$. Right holds $b=1$ and moves the singleton comparison from rank 1 to ranks 2, 3, and 5. A weaker singleton raises the intercept but does not change the line's slope.])
]
