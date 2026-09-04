#import "@preview/lilaq:0.6.0" as lq

#let coverage = (1, 2, 3, 4, 5, 6, 7)
#let inverse-multiplier(n) = 1 / n
// The logarithmic series use B = 1 / ln(1 + b), making their one-retriever multiplier one.
#let log-multiplier(n, b) = calc.ln(n + b) / calc.ln(1 + b)
#let saturated-multiplier(n, a, b, t) = 1 + a * (1 - calc.exp((1 + b - n) / t))

#let red-light = rgb("#FC9272")
#let red-dark = rgb("#DE2D26")
#let blue-light = rgb("#DEEBF7")
#let blue-medium = rgb("#9ECAE1")
#let blue-dark = rgb("#3182BD")
#let green-light = rgb("#E5F5E0")
#let green-medium = rgb("#A1D99B")
#let green-dark = rgb("#31A354")

#let coverage-multiplier-curves-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Bounded saturation changes the multiplier, not the rank contributions being summed]#linebreak()
  #text(size: 7pt)[The black curve is coverage division. Dotted red curves are logarithmic RRF with $B=1/ln(1+b)$, dashed blue curves are saturated RRF with $b=0$, and solid green curves isolate the one-retriever penalty from $b$ at $a=2$, $t=2$. Every saturated curve approaches the asymptote $1+a$; smaller $t$ front-loads the reward and larger $t$ spreads it. The vertical axis begins at zero; returned documents begin at one supporting retriever.]
  #v(3pt)
  #lq.diagram(
    width: 14.5cm,
    height: 7.2cm,
    xlabel: [supporting retrievers $|R_d|$],
    ylabel: [coverage multiplier],
    xlim: (0.5, 7.5),
    ylim: (0, 3.45),
    xaxis: (ticks: coverage.map(n => (n, [#n]))),
    yaxis: (ticks: ((0, [0]), (1, [1]), (2, [2]), (3, [3]))),
    grid: (stroke: 0.25pt + luma(225)),
    legend: (position: bottom + right),
    lq.plot(coverage, coverage.map(n => inverse-multiplier(n)), label: [$C_"inv"(n)$], color: black, stroke: 1.4pt + black, mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => log-multiplier(n, 1)), label: [$C_"log"(n; 1, 1/ln 2)$], color: red-dark, stroke: (paint: red-dark, thickness: 1.5pt, dash: "dotted"), mark: "o", mark-size: 2.7pt),
    lq.plot(coverage, coverage.map(n => log-multiplier(n, 2)), label: [$C_"log"(n; 2, 1/ln 3)$], color: red-light, stroke: (paint: red-light, thickness: 1.5pt, dash: "dotted"), mark: "o", mark-size: 2.7pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 1, 0, 1)), label: [$C_"sat"(n; 1, 0, 1)$], color: blue-light, stroke: (paint: blue-light, thickness: 1.4pt, dash: "dashed"), mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 1, 0, 2)), label: [$C_"sat"(n; 1, 0, 2)$], color: blue-medium, stroke: (paint: blue-medium, thickness: 1.4pt, dash: "dashed"), mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 2, 0, 1)), label: [$C_"sat"(n; 2, 0, 1)$], color: blue-dark, stroke: (paint: blue-dark, thickness: 1.4pt, dash: "dashed"), mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 2, 0, 2)), label: [$C_"sat"(n; 2, 0, 2)$], color: green-light, stroke: 1.4pt + green-light, mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 2, 0.1, 2)), label: [$C_"sat"(n; 2, 0.1, 2)$], color: green-medium, stroke: 1.4pt + green-medium, mark: "o", mark-size: 2.6pt),
    lq.plot(coverage, coverage.map(n => saturated-multiplier(n, 2, 0.3, 2)), label: [$C_"sat"(n; 2, 0.3, 2)$], color: green-dark, stroke: 1.4pt + green-dark, mark: "o", mark-size: 2.6pt),
  )
]
