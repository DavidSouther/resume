#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let ink = rgb("#1f2937")
#let grey = rgb("#64748b")

// The same score ratios as Figure 12, transformed with log10. Zero is the
// rank-1 singleton baseline; negative bars lose and positive bars win.
#let log-ratios = (0.3174, 0.0396, 0.3594, -0.1096, 0.0823, -0.4188, 0.0)
#let rows = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
#let fills = (violet, green, green, blue, blue, grey, ink)
#let ratio-labels = ([2.08×], [1.10×], [2.29×], [0.78×], [1.21×], [0.38×], [1.00×])

#let log-profile-chart = lq.diagram(
  width: 14.5cm,
  height: 7.4cm,
  xlabel: [$log_10$(score / rank-1 singleton); left loses, right wins],
  xlim: (-0.52, 0.47),
  ylim: (0.45, 7.55),
  xaxis: (ticks: ((-0.4, [−0.4]), (-0.2, [−0.2]), (0, [0]), (0.2, [0.2]), (0.4, [0.4]))),
  yaxis: (
    ticks: (
      (1, [5 lists: ranks 100, 300, 500, 700, 900]),
      (2, [3 lists: ranks 100, 500, 1000]),
      (3, [3 lists: ranks 100, 100, 100]),
      (4, [2 lists: ranks 100, 500]),
      (5, [2 lists: ranks 100, 100]),
      (6, [1 list: rank 100]),
      (7, [1 list: rank 1 (baseline)]),
    ),
    subticks: none,
  ),
  grid: (stroke: 0.25pt + luma(225)),
  lq.hbar(log-ratios, rows, fill: fills, width: 58%, base: 0),
  lq.line((0, 0.5), (0, 7.5), stroke: (paint: orange, thickness: 1.2pt, dash: "dashed")),
  ..log-ratios.enumerate().map(entry => {
    let index = entry.at(0)
    let value = entry.at(1)
    let narrow-win = value > 0 and value < 0.06
    let label-x = if value < 0 { value + 0.018 } else if narrow-win { value + 0.012 } else { value - 0.018 }
    let label-align = if value < 0 or narrow-win { left } else { right }
    let label-fill = if value == 0 { ink } else if narrow-win { fills.at(index) } else { white }
    lq.place(label-x, rows.at(index), align: label-align, text(size: 7pt, weight: "bold", fill: label-fill)[#ratio-labels.at(index)])
  }),
)

#let rank-profile-comparison-log-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Figure 12 on a logarithmic ratio scale]
  #text(size: 7pt)[The data and defaults are unchanged: $k=60$, $b=1$. Taking $log_10$ moves the rank-1 singleton tie to zero and gives wins and losses equal visual treatment.]
  #v(3pt)
  #log-profile-chart
  #v(2pt)
  #align(center, text(size: 7pt)[The logarithmic view makes the close comparisons explicit. Ranks $(100,500,1000)$ win by only $1.10 times$, while $(100,500)$ lose at $0.78 times$. The broader and consistently strong profiles remain visibly distinct rather than being compressed against a linear baseline.])
]
