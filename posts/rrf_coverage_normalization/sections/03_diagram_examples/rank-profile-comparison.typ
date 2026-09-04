#import "@preview/lilaq:0.6.0" as lq

// ColorBrewer Set1 red and blue are categorical, colorblind-safe, and remain
// distinct when printed in black and white.
#let log-fill = rgb("#E41A1C")
#let saturated-fill = rgb("#377EB8")
#let profiles = (
  [5 lists: ranks 100, 300, 500, 700, 900],
  [3 lists: ranks 100, 500, 1000],
  [3 lists: ranks 100, 100, 100],
  [2 lists: ranks 100, 500],
  [2 lists: ranks 100, 100],
  [1 list: rank 100],
  [1 list: rank 1 (baseline)],
)
#let logrrf-ratios = (2.076831, 1.095451, 2.287500, 0.776915, 1.208534, 0.381250, 1.000000)
#let saturated-ratios = (3.392621, 1.838151, 3.838390, 1.209023, 1.880703, 0.381250, 1.000000)
#let profile-centres = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
// Equal 0.30-height bars touch at each profile centre. The remaining 0.40
// between pairs is deliberate vertical whitespace.
#let pair-bar-width = 30%
#let pair-offset = 0.15
#let log-rows = profile-centres.map(y => y - pair-offset)
#let saturated-rows = profile-centres.map(y => y + pair-offset)

#let profile-chart = lq.diagram(
  width: 14.5cm,
  height: 8.1cm,
  xlabel: [score relative to each method's one-rank-1 singleton],
  xlim: (0, 4.15), ylim: (0.35, 7.65),
  xaxis: (ticks: ((0, [0]), (1, [1]), (2, [2]), (3, [3]), (4, [4]))),
  yaxis: (ticks: profile-centres.zip(profiles), subticks: none),
  grid: (stroke: 0.25pt + luma(225)),
  lq.hbar(logrrf-ratios, log-rows, fill: log-fill, width: pair-bar-width),
  lq.hbar(saturated-ratios, saturated-rows, fill: saturated-fill, width: pair-bar-width),
  lq.line((1, 0.4), (1, 7.6), stroke: (paint: rgb("#666666"), thickness: 1.1pt, dash: "dashed")),
  ..logrrf-ratios.enumerate().map(entry => lq.place(entry.at(1) + 0.04, log-rows.at(entry.at(0)), align: left, text(size: 6.5pt, weight: "bold", fill: log-fill)[#calc.round(entry.at(1), digits: 2)×])),
  ..saturated-ratios.enumerate().map(entry => lq.place(entry.at(1) + 0.04, saturated-rows.at(entry.at(0)), align: left, text(size: 6.5pt, weight: "bold", fill: saturated-fill)[#calc.round(entry.at(1), digits: 2)×])),
)

#let rank-profile-comparison-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[LogRRF and saturated RRF give the same rank profiles different coverage rewards]
  #text(size: 7pt)[Red bars are logRRF ($k=60$, $b=1$); blue bars are $S_"sat"(d;3,0.1,2)$. Equal-height touching bars form one profile; whitespace separates profiles.]
  #v(3pt)
  #profile-chart
]
