#import "@preview/lilaq:0.6.0" as lq

// ColorBrewer Set1 colors identify the five method panels in reading order.
#let log-fill = rgb("#E41A1C")
#let rbc-fill = rgb("#377EB8")
#let isr-fill = rgb("#4DAF4A")
#let logisr-fill = rgb("#984EA3")
#let saturated-fill = rgb("#FF7F00")
#let baseline-fill = rgb("#666666")

#let rows = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
#let profile-ticks = (
  (1, text(size: 6pt)[P7]),
  (2, text(size: 6pt)[P6]),
  (3, text(size: 6pt)[P5]),
  (4, text(size: 6pt)[P4]),
  (5, text(size: 6pt)[P3]),
  (6, text(size: 6pt)[P2]),
  (7, text(size: 6pt)[P1]),
)

#let compact-chart(
  values,
  labels,
  bar-fill,
  xmin,
  xmax,
  ticks,
  label-offset,
  narrow-threshold,
  baseline-left: false,
  zero-singletons: false,
) = lq.diagram(
  width: 7.15cm,
  height: 4.6cm,
  xlim: (xmin, xmax),
  ylim: (0.45, 7.55),
  xaxis: (ticks: ticks),
  yaxis: (ticks: profile-ticks, subticks: none),
  grid: (stroke: 0.2pt + luma(228)),
  lq.hbar(
    if zero-singletons { values.slice(0, 5) } else { values },
    if zero-singletons { rows.slice(0, 5) } else { rows },
    fill: bar-fill,
    width: 55%,
    base: 0,
  ),
  lq.line((0, 0.5), (0, 7.5), stroke: (paint: baseline-fill, thickness: 1pt, dash: "dashed")),
  ..values.slice(0, if zero-singletons { 5 } else { values.len() }).enumerate().map(entry => {
    let index = entry.at(0)
    let value = entry.at(1)
    let narrow = calc.abs(value) < narrow-threshold
    let label-x = if value == 0 and baseline-left { value - label-offset } else if value < 0 { value + label-offset } else if narrow { value + label-offset } else { value - label-offset }
    let label-align = if value == 0 and baseline-left { right } else if value < 0 or narrow { left } else { right }
    let label-fill = if value == 0 or narrow { bar-fill } else { white }
    lq.place(label-x, rows.at(index), align: label-align, text(size: 5.5pt, weight: "bold", fill: label-fill)[#labels.at(index)])
  }),
  if zero-singletons {
    lq.place(xmin + label-offset, 6, align: left, text(size: 5.5pt, weight: "bold", fill: logisr-fill)[zero])
  },
  if zero-singletons {
    lq.place(xmin + label-offset, 7, align: left, text(size: 5.5pt, weight: "bold", fill: logisr-fill)[zero])
  },
)

#let log-rrf = compact-chart(
  (0.3174, 0.0396, 0.3594, -0.1096, 0.0823, -0.4188, 0.0),
  ([2.08×], [1.10×], [2.29×], [0.78×], [1.21×], [0.38×], [1×]),
  log-fill,
  -0.52,
  0.47,
  ((-0.4, [−.4]), (0, [0]), (0.4, [.4])),
  0.018,
  0.1,
)

#let rbc = compact-chart(
  (-15.3353, -15.3353, -14.8582, -15.3353, -15.0343, -15.3353, 0.0),
  ([4.6e−16×], [4.6e−16×], [1.4e−15×], [4.6e−16×], [9.2e−16×], [4.6e−16×], [1×]),
  rbc-fill,
  -16.5,
  0.7,
  ((-16, [−16]), (-8, [−8]), (0, [0])),
  0.3,
  0.8,
  baseline-left: true,
)

#let isr = compact-chart(
  (-3.2277, -3.5017, -3.0458, -3.6819, -3.3979, -4.0, 0.0),
  ([5.9e−4×], [3.2e−4×], [9e−4×], [2.1e−4×], [4e−4×], [1e−4×], [1×]),
  isr-fill,
  -4.5,
  0.65,
  ((-4, [−4]), (-2, [−2]), (0, [0])),
  0.1,
  0.3,
)

#let log-isr = compact-chart(
  (-3.8619, -4.0798, -3.6239, -4.2840, -4.0, 0.0, 0.0),
  ([1.4e−4×], [8.3e−5×], [2.4e−4×], [5.2e−5×], [1e−4×], [], []),
  logisr-fill,
  -4.8,
  0.65,
  ((-4, [−4]), (-2, [−2]), (0, [0])),
  0.1,
  0.3,
  zero-singletons: true,
)

#let saturated-rrf = compact-chart(
  (0.5305, 0.2644, 0.5841, 0.0824, 0.2743, -0.4188, 0.0),
  ([3.39×], [1.84×], [3.84×], [1.21×], [1.88×], [0.38×], [1×]),
  saturated-fill,
  -0.52,
  0.7,
  ((-0.4, [−.4]), (0, [0]), (0.4, [.4])),
  0.018,
  0.1,
)

#let panel(title, body) = block(width: 100%)[
  #align(center, text(size: 7pt, weight: "bold")[#title])
  #v(1pt)
  #body
]

#let profile-key = block(width: 100%)[
  #align(center, text(size: 6.2pt)[P1 $(1)$ · P2 $(100)$ · P3 $(100,100)$ · P4 $(100,500)$])
  #align(center, text(size: 6.2pt)[P5 $(100,100,100)$ · P6 $(100,500,1000)$ · P7 $(100,300,500,700,900)$])
  #align(center, text(size: 6.2pt, fill: baseline-fill)[Bars show $log_10$(score / baseline); dashed zero is a tie.])
]

#let rank-profile-comparison-grid-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[The same retriever evidence produces five qualitatively different rankings]
  #text(size: 7pt)[Every panel uses the Figure 1 profiles. Panels (a)--(c) and (e) compare with one rank-1 appearance; logISR cannot use a singleton baseline, so panel (d) compares with ranks $(1,1)$.]
  #v(3pt)
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 0.35cm,
    row-gutter: 0.3cm,
    panel([(a) logRRF, $k=60$, $b=1$], log-rrf),
    panel([(b) Rank-Biased Centroid, $phi=0.7$], rbc),
    panel([(c) ISR], isr),
    panel([(d) logISR], log-isr),
    grid.cell(colspan: 2, align: center, panel([(e) Saturated RRF, $(a,b,t)=(3,0.1,2)$], saturated-rrf)),
  )
  #v(3pt)
  #profile-key
]
