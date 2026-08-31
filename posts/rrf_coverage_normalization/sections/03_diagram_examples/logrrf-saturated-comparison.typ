#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let ink = rgb("#1f2937")
#let grey = rgb("#64748b")

#let logrrf-ratios = (2.077, 1.095, 2.288, 0.777, 1.209, 0.381, 1.0)
#let saturated-ratios = (1.498124, 0.893954, 1.866738, 0.683049, 1.062520, 0.381250, 1.0)
#let rows = (1, 2, 3, 4, 5, 6, 7)
#let fills = (violet, green, green, blue, blue, grey, ink)
#let profiles = (
  (1, [P7], [P7 $(100,300,500,700,900)$]),
  (2, [P6], [P6 $(100,500,1000)$]),
  (3, [P5], [P5 $(100,100,100)$]),
  (4, [P4], [P4 $(100,500)$]),
  (5, [P3], [P3 $(100,100)$]),
  (6, [P2], [P2 $(100)$]),
  (7, [P1], [P1 $(1)$]),
)
#let profile-ticks = profiles.map(profile => (profile.at(0), profile.at(1)))
// Typst 0.15 expresses calc.log10(x) as calc.log(x, base: 10).
#let log10(value) = calc.log(value, base: 10)

#let panel(title, ratios) = block(width: 100%)[
  #align(center, text(size: 7pt, weight: "bold")[#title])
  #v(1pt)
  #lq.diagram(
    width: 7.1cm,
    height: 5.1cm,
    xlim: (-0.55, 0.45),
    ylim: (0.45, 7.55),
    xaxis: (ticks: ((-0.4, [−.4]), (0, [0]), (0.4, [.4]))),
    yaxis: (ticks: profile-ticks, subticks: none),
    grid: (stroke: 0.2pt + luma(228)),
    lq.hbar(ratios.map(log10), rows, fill: fills, width: 55%, base: 0),
    lq.line((0, 0.5), (0, 7.5), stroke: (paint: orange, thickness: 1pt, dash: "dashed")),
  )
]

#let logrrf-saturated-comparison-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Saturation moderates agreement promotion without removing it]
  #text(size: 7pt)[Both panels use $k=60$ and compare with a single rank-1 result. Saturated RRF uses $a=1$, $b=0$, $t=2$.]
  #v(3pt)
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 0.35cm,
    panel([a. logRRF], logrrf-ratios),
    panel([b. saturated RRF], saturated-ratios),
  )
  #v(3pt)
  #align(center, text(size: 6.2pt)[P1 $(1)$ · P2 $(100)$ · P3 $(100,100)$ · P4 $(100,500)$])
  #align(center, text(size: 6.2pt)[P5 $(100,100,100)$ · P6 $(100,500,1000)$ · P7 $(100,300,500,700,900)$])
  #align(center, text(size: 6.2pt, fill: grey)[Bars show $log_10$(score / baseline); dashed zero is a tie.])
]
