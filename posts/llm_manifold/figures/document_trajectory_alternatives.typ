// Design-source alternatives for the "trajectory in document space" figure.
// Compile later with, for example:
//   typst compile posts/llm_manifold/figures/document_trajectory_alternatives.typ /tmp/document-trajectory-{p}.svg

#set page(width: 180mm, height: 128mm, margin: 8mm)
#set text(size: 8.5pt)

#let ink = rgb("#17212b")
#let muted = rgb("#62707f")
#let grid = rgb("#d6dde6")
#let soft = rgb("#f7f9fb")
#let contour = rgb("#598caa")
#let contour-soft = rgb("#bfd7e6")
#let path-red = rgb("#b84632")
#let path-red-soft = rgb("#efb2a5")
#let target = rgb("#2f7d62")
#let target-soft = rgb("#dcefe8")
#let peak = rgb("#7a5fb0")
#let peak-soft = rgb("#ece7f7")
#let plain = rgb("#d8eadf")

#let dot(fill) = circle(radius: 1.7mm, fill: fill, stroke: 0.45pt + white)
#let point-label(body) = box(inset: (x: 1.5mm, y: 0.7mm), fill: white, stroke: 0.35pt + grid)[#text(size: 6.6pt, fill: ink)[#body]]
#let panel-title(body) = text(size: 10pt, weight: "semibold", fill: ink)[#body]
#let note(body) = text(size: 6.7pt, fill: muted)[#body]

#let arrowhead(fill) = polygon(
  fill: fill,
  stroke: none,
  (0mm, 0mm),
  (4mm, 1.6mm),
  (0mm, 3.2mm),
)

#panel-title[Alternative A: contour map of likely continuations]

#box(width: 164mm, height: 86mm, fill: soft, stroke: 0.5pt + grid)[
  #place(dx: 8mm, dy: 7mm)[#text(size: 7pt, fill: muted)[Document-space coordinates are schematic; contours encode local continuation likelihood, not a proven metric.]]

  // Broad plausible plain: many nearby continuations have comparable probability.
  #place(dx: 84mm, dy: 17mm)[#ellipse(width: 55mm, height: 28mm, fill: plain, stroke: 0.7pt + target)]
  #place(dx: 99mm, dy: 27mm)[#point-label[plausible plain]]

  // Valley: a narrower high-probability route through prefix states.
  #place(dx: 19mm, dy: 24mm)[#ellipse(width: 118mm, height: 43mm, stroke: 0.7pt + contour-soft)]
  #place(dx: 31mm, dy: 32mm)[#ellipse(width: 94mm, height: 30mm, stroke: 0.7pt + contour)]
  #place(dx: 43mm, dy: 39mm)[#ellipse(width: 65mm, height: 18mm, stroke: 0.9pt + contour)]
  #place(dx: 56mm, dy: 44mm)[#ellipse(width: 36mm, height: 8mm, stroke: 1pt + contour)]
  #place(dx: 52mm, dy: 55mm)[#point-label[high-probability valley]]

  // Peak or ridge: a low-probability continuation can be named or redirected to,
  // but the model will not normally continue toward it from the local prefix.
  #place(dx: 117mm, dy: 51mm)[#ellipse(width: 27mm, height: 18mm, fill: peak-soft, stroke: 0.8pt + peak)]
  #place(dx: 124mm, dy: 58mm)[#ellipse(width: 13mm, height: 8mm, stroke: 1pt + peak)]
  #place(dx: 119mm, dy: 72mm)[#point-label[low-probability ridge]]

  // Trajectory.
  #place(dx: 26mm, dy: 69mm)[#line(length: 25mm, angle: -28deg, stroke: 1.1pt + path-red)]
  #place(dx: 50mm, dy: 56mm)[#line(length: 24mm, angle: -12deg, stroke: 1.1pt + path-red)]
  #place(dx: 73mm, dy: 51mm)[#line(length: 27mm, angle: -18deg, stroke: 1.1pt + path-red)]
  #place(dx: 99mm, dy: 43mm)[#line(length: 23mm, angle: -6deg, stroke: 1.1pt + path-red)]
  #place(dx: 119mm, dy: 41mm)[#arrowhead(path-red)]

  #place(dx: 24mm, dy: 67mm)[#dot(path-red)]
  #place(dx: 49mm, dy: 55mm)[#dot(path-red)]
  #place(dx: 73mm, dy: 50mm)[#dot(path-red)]
  #place(dx: 99mm, dy: 42mm)[#dot(path-red)]
  #place(dx: 124mm, dy: 40mm)[#dot(path-red)]

  #place(dx: 20mm, dy: 75mm)[#point-label[$d_0$]]
  #place(dx: 47mm, dy: 61mm)[#point-label[$d_1$]]
  #place(dx: 71mm, dy: 56mm)[#point-label[$d_2$]]
  #place(dx: 117mm, dy: 32mm)[#point-label[$d_T$]]

  #place(dx: 27mm, dy: 12mm)[#text(size: 7.1pt, fill: path-red)[generation trajectory]]
  #place(dx: 130mm, dy: 8mm)[#text(size: 7pt, fill: target)[acceptable task region]]
  #place(dx: 137mm, dy: 16mm)[#circle(radius: 4.5mm, fill: target-soft, stroke: 0.7pt + target)]
]

#note[Use this if the paper wants the strongest visual link between prefixes, continuation probability, and task-local regions.]

#pagebreak()

#panel-title[Alternative B: terrain profile along one local direction]

#box(width: 164mm, height: 86mm, fill: soft, stroke: 0.5pt + grid)[
  #place(dx: 10mm, dy: 72mm)[#line(length: 140mm, angle: 0deg, stroke: 0.7pt + grid)]
  #place(dx: 13mm, dy: 16mm)[#line(length: 56mm, angle: 90deg, stroke: 0.7pt + grid)]
  #place(dx: 18mm, dy: 12mm)[#text(size: 6.5pt, fill: muted)[higher surprise / lower probability]]
  #place(dx: 122mm, dy: 76mm)[#text(size: 6.5pt, fill: muted)[local continuation direction]]

  // Piecewise terrain line.
  #place(dx: 20mm, dy: 58mm)[#line(length: 24mm, angle: -37deg, stroke: 1.1pt + contour)]
  #place(dx: 39mm, dy: 43mm)[#line(length: 25mm, angle: -16deg, stroke: 1.1pt + contour)]
  #place(dx: 63mm, dy: 36mm)[#line(length: 34mm, angle: 2deg, stroke: 1.1pt + contour)]
  #place(dx: 96mm, dy: 37mm)[#line(length: 27mm, angle: 31deg, stroke: 1.1pt + contour)]
  #place(dx: 119mm, dy: 51mm)[#line(length: 21mm, angle: -44deg, stroke: 1.1pt + contour)]
  #place(dx: 136mm, dy: 36mm)[#line(length: 15mm, angle: 8deg, stroke: 1.1pt + contour)]

  // Prefix states lie on the sampled profile.
  #place(dx: 20mm, dy: 58mm)[#dot(path-red)]
  #place(dx: 42mm, dy: 42mm)[#dot(path-red)]
  #place(dx: 67mm, dy: 36mm)[#dot(path-red)]
  #place(dx: 92mm, dy: 36mm)[#dot(path-red)]
  #place(dx: 142mm, dy: 36mm)[#dot(peak)]

  #place(dx: 18mm, dy: 63mm)[#point-label[$d_0$]]
  #place(dx: 39mm, dy: 31mm)[#point-label[steeper valley]]
  #place(dx: 67mm, dy: 25mm)[#point-label[flat plausible plain]]
  #place(dx: 126mm, dy: 26mm)[#point-label[prompted or redirected start]]
  #place(dx: 123mm, dy: 55mm)[#point-label[unlikely from here]]

  #place(dx: 20mm, dy: 58mm)[#line(length: 22mm, angle: -37deg, stroke: 1.2pt + path-red)]
  #place(dx: 42mm, dy: 42mm)[#line(length: 25mm, angle: -16deg, stroke: 1.2pt + path-red)]
  #place(dx: 67mm, dy: 36mm)[#line(length: 25mm, angle: 0deg, stroke: 1.2pt + path-red)]
  #place(dx: 90mm, dy: 34mm)[#arrowhead(path-red)]

  #place(dx: 111mm, dy: 34mm)[#line(length: 31mm, angle: 4deg, stroke: 0.8pt + path-red-soft)]
  #place(dx: 139mm, dy: 33mm)[#arrowhead(path-red-soft)]
]

#note[Use this if the manuscript needs the "valley / plain / ridge" explanation more than a literal map.]

#pagebreak()

#panel-title[Alternative C: prefix-state flow with branch likelihoods]

#box(width: 164mm, height: 86mm, fill: soft, stroke: 0.5pt + grid)[
  #place(dx: 10mm, dy: 8mm)[#text(size: 7pt, fill: muted)[Each node is a prefix. Edge weight sketches relative next-token continuation probability.]]

  // Main high-probability branch.
  #place(dx: 26mm, dy: 43mm)[#line(length: 33mm, angle: -18deg, stroke: 1.5pt + path-red)]
  #place(dx: 59mm, dy: 33mm)[#line(length: 34mm, angle: 11deg, stroke: 1.5pt + path-red)]
  #place(dx: 92mm, dy: 40mm)[#line(length: 35mm, angle: -8deg, stroke: 1.5pt + path-red)]
  #place(dx: 124mm, dy: 35mm)[#arrowhead(path-red)]

  // Plausible alternatives.
  #place(dx: 58mm, dy: 33mm)[#line(length: 24mm, angle: -50deg, stroke: 0.8pt + contour)]
  #place(dx: 58mm, dy: 33mm)[#line(length: 24mm, angle: 50deg, stroke: 0.8pt + contour)]
  #place(dx: 92mm, dy: 40mm)[#line(length: 25mm, angle: 35deg, stroke: 0.8pt + contour)]
  #place(dx: 92mm, dy: 40mm)[#line(length: 26mm, angle: -38deg, stroke: 0.8pt + contour)]

  // Low-probability branch.
  #place(dx: 26mm, dy: 43mm)[#line(length: 44mm, angle: 33deg, stroke: 0.55pt + peak)]
  #place(dx: 68mm, dy: 67mm)[#line(length: 35mm, angle: -4deg, stroke: 0.55pt + peak)]

  // Nodes.
  #place(dx: 24mm, dy: 41mm)[#dot(path-red)]
  #place(dx: 57mm, dy: 31mm)[#dot(path-red)]
  #place(dx: 91mm, dy: 38mm)[#dot(path-red)]
  #place(dx: 126mm, dy: 33mm)[#dot(path-red)]
  #place(dx: 80mm, dy: 12mm)[#dot(contour)]
  #place(dx: 80mm, dy: 54mm)[#dot(contour)]
  #place(dx: 115mm, dy: 54mm)[#dot(contour)]
  #place(dx: 115mm, dy: 20mm)[#dot(contour)]
  #place(dx: 69mm, dy: 65mm)[#dot(peak)]
  #place(dx: 103mm, dy: 63mm)[#dot(peak)]

  #place(dx: 18mm, dy: 49mm)[#point-label[$d_0$]]
  #place(dx: 51mm, dy: 21mm)[#point-label[likely branch]]
  #place(dx: 76mm, dy: 59mm)[#point-label[nearby variants]]
  #place(dx: 63mm, dy: 72mm)[#point-label[low-probability branch]]
  #place(dx: 119mm, dy: 24mm)[#point-label[$d_T$]]

  #place(dx: 122mm, dy: 62mm)[#box(width: 26mm, height: 12mm, fill: target-soft, stroke: 0.7pt + target)[#align(center + horizon)[#text(size: 6.4pt, fill: target)[acceptable region]]]]
]

#note[Use this if the figure should emphasize discrete prefixes rather than a continuous surface.]

#pagebreak()

#panel-title[Alternative D: task-local regions, not one global manifold]

#box(width: 164mm, height: 86mm, fill: soft, stroke: 0.5pt + grid)[
  #place(dx: 9mm, dy: 8mm)[#text(size: 7pt, fill: muted)[A document-space sketch can show separate task-local regions while still drawing a trajectory inside one region.]]

  // Disconnected local regions.
  #place(dx: 16mm, dy: 25mm)[#ellipse(width: 54mm, height: 35mm, fill: rgb("#edf6fb"), stroke: 0.8pt + contour)]
  #place(dx: 74mm, dy: 16mm)[#ellipse(width: 42mm, height: 26mm, fill: rgb("#f7f0e1"), stroke: 0.8pt + rgb("#b78c31"))]
  #place(dx: 107mm, dy: 47mm)[#ellipse(width: 38mm, height: 24mm, fill: peak-soft, stroke: 0.8pt + peak)]
  #place(dx: 58mm, dy: 52mm)[#ellipse(width: 61mm, height: 26mm, fill: target-soft, stroke: 0.8pt + target)]

  #place(dx: 24mm, dy: 18mm)[#point-label[local language region]]
  #place(dx: 79mm, dy: 11mm)[#point-label[separate task region]]
  #place(dx: 111mm, dy: 41mm)[#point-label[low-probability island]]
  #place(dx: 69mm, dy: 68mm)[#point-label[acceptable region]]

  // Trajectory within one local region.
  #place(dx: 25mm, dy: 44mm)[#line(length: 23mm, angle: 8deg, stroke: 1.2pt + path-red)]
  #place(dx: 48mm, dy: 47mm)[#line(length: 24mm, angle: 18deg, stroke: 1.2pt + path-red)]
  #place(dx: 71mm, dy: 54mm)[#line(length: 23mm, angle: -6deg, stroke: 1.2pt + path-red)]
  #place(dx: 91mm, dy: 52mm)[#arrowhead(path-red)]

  #place(dx: 23mm, dy: 42mm)[#dot(path-red)]
  #place(dx: 48mm, dy: 46mm)[#dot(path-red)]
  #place(dx: 71mm, dy: 53mm)[#dot(path-red)]
  #place(dx: 96mm, dy: 51mm)[#dot(path-red)]

  #place(dx: 22mm, dy: 49mm)[#point-label[$d_0$]]
  #place(dx: 45mm, dy: 54mm)[#point-label[$d_1$]]
  #place(dx: 92mm, dy: 57mm)[#point-label[$d_T$]]

  // External start into another region.
  #place(dx: 87mm, dy: 29mm)[#line(length: 35mm, angle: 42deg, stroke: 0.8pt + path-red-soft)]
  #place(dx: 119mm, dy: 48mm)[#arrowhead(path-red-soft)]
  #place(dx: 85mm, dy: 34mm)[#text(size: 6.5pt, fill: path-red-soft)[prompted start elsewhere]]
]

#note[Use this if the section's caveat about disconnected, task-local regions should be visible in the same figure.]
