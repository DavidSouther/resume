#import "@preview/lilaq:0.6.0" as lq

// Figure 1: rank ballots and policy fingerprints.
//
// This module owns the paper's one analytic ballot fixture and every score it
// reports. There is no continuous field here: a rank is always an integer slot,
// never an axis, a curve, or a shaded region. No plotting package is imported.

// Retriever identity is the figure's only hue channel. The hues are Okabe-Ito
// colour-universal values; every fact they carry is also printed as text, so
// the figure loses nothing in greyscale.
#let retrievers = (
  (id: "R1", colour: rgb("#0072B2")),
  (id: "R2", colour: rgb("#D55E00")),
  (id: "R3", colour: rgb("#009E73")),
)

#let ballot-depth = 12

// The five fixed documents. `ranks` is one entry per retriever, in retriever
// order; `none` means that retriever did not return the document. Roles are
// worded from ballot position only, so the shared ballot stays neutral for the
// four panels whose scores never consider a retriever weight.
#let documents = (
  (id: "H", role: "one head placement", ranks: (1, none, none)),
  (id: "D", role: "two head placements", ranks: (none, 1, 1)),
  (id: "B", role: "three near-head placements", ranks: (3, 3, 4)),
  (id: "S", role: "one near-head and one deep placement", ranks: (8, none, 2)),
  (id: "C", role: "three deep placements", ranks: (12, 12, 12)),
)

#let ink = rgb("#1f2937")

// ---------------------------------------------------------------------------
// Normalization. Each document is converted once into the shape the kernels
// need, so no kernel re-derives coverage or filters absent retrievers again.
// ---------------------------------------------------------------------------
#let present-support(document) = {
  let ranks = document.ranks.filter(rank => rank != none)
  (ranks: ranks, coverage: ranks.len())
}

// ---------------------------------------------------------------------------
// Score kernels. Every formula is transcribed from the paper's own
// "Mathematical Formulation" section; none is invented here.
// ---------------------------------------------------------------------------

// S_RRF(d) = sum over supporting retrievers of 1 / (k + r_i(d))
#let rrf-score(support, k) = support.ranks.fold(0.0, (total, rank) => total + 1.0 / (k + rank))

// S_avg(d) = S_RRF(d) / n(d)
#let coverage-division-score(support, k) = rrf-score(support, k) / support.coverage

// S_w(d) = sum over supporting retrievers of w_i / (k + r_i(d)).
// Weights are positional, so this reads the raw three-slot ranks, not the
// compacted present-rank list.
#let weighted-score(document, weights, k) = {
  let total = 0.0
  for (index, rank) in document.ranks.enumerate() {
    if rank != none { total += weights.at(index) / (k + rank) }
  }
  total
}

// S_RBC(d; phi) = sum of q_phi(r_i(d)), with the phi = 0 endpoint defined by
// continuous extension rather than by evaluating zero to the power zero.
#let rbc-kernel(rank, phi) = {
  if phi == 0 { if rank == 1 { 1.0 } else { 0.0 } } else { (1 - phi) * calc.pow(phi, rank - 1) }
}
#let rbc-score(support, phi) = support.ranks.fold(0.0, (total, rank) => total + rbc-kernel(rank, phi))

// S_ISR(d) = n(d) * Q_ISR(d), where Q_ISR(d) = sum of 1 / r_i(d)^2
#let isr-score(support) = {
  support.coverage * support.ranks.fold(0.0, (total, rank) => total + 1.0 / (rank * rank))
}

// The singleton-normalized logarithmic default:
// S(d) = S_RRF(d) * ln(n(d) + b) / ln(1 + b), so B = 1 / ln(1 + b).
#let log-rrf-score(support, k, b) = {
  rrf-score(support, k) * calc.ln(support.coverage + b) / calc.ln(1 + b)
}

#let score-for(document, family, params) = {
  let support = present-support(document)
  if family == "rrf" { rrf-score(support, params.k) } else if family == "avg" {
    coverage-division-score(support, params.k)
  } else if family == "weighted" {
    weighted-score(document, params.w, params.k)
  } else if family == "rbc" { rbc-score(support, params.phi) } else if family == "isr" {
    isr-score(support)
  } else if family == "log" { log-rrf-score(support, params.k, params.b) } else {
    panic("unknown score family: " + family)
  }
}

// ---------------------------------------------------------------------------
// Ordering. Whole tie groups are taken until `take` documents are covered, so a
// tie is never split across the boundary. Declaration order is an explicit
// tiebreaker rather than a reliance on the sort being stable.
// ---------------------------------------------------------------------------
#let tie-tolerance = 1e-12

#let top-groups(docs, family, params, take: 3) = {
  let scored = docs
    .enumerate()
    .map(((index, document)) => (id: document.id, value: score-for(document, family, params), index: index))
    .sorted(key: entry => (-entry.value, entry.index))
  let groups = ()
  let covered = 0
  for entry in scored {
    if groups.len() > 0 and calc.abs(groups.last().value - entry.value) <= tie-tolerance {
      groups.last().ids.push(entry.id)
    } else {
      if covered >= take { break }
      groups.push((ids: (entry.id,), value: entry.value))
    }
    covered += 1
  }
  groups.map(group => group.ids)
}

// ---------------------------------------------------------------------------
// Published data. The figure renders from this and the feature test reads it,
// so what is drawn and what is verified cannot drift apart.
// ---------------------------------------------------------------------------
#let ranks-of(id) = documents.find(document => document.id == id).ranks

// `label` is an ASCII key, so a test never depends on how a parameter is
// typeset. `display` is the typeset form the reader sees.
#let make-stack(label, display, family, params, phrase) = {
  let groups = top-groups(documents, family, params)
  let promoted = groups.first()
  (
    label: label,
    display: display,
    family: family,
    params: params,
    phrase: phrase,
    promoted: promoted,
    pattern: promoted.map(ranks-of),
    groups: groups,
  )
}

#let coincidence-note = "Logarithmic RRF reaches this order at $k=20$ because of its coverage multiplier. Base RRF reaches it at $k=60$ because larger $k$ reduces the difference between ranks."

#let fingerprint-data = (
  depth: ballot-depth,
  retrievers: retrievers.map(retriever => retriever.id),
  documents: documents,
  panels: (
    (
      id: "base-rrf",
      family: "Base RRF",
      note: coincidence-note,
      stacks: (
        make-stack("k=20", "$k = 20$ (tuned comparison)", "rrf", (k: 20), "early placements accumulate"),
        make-stack("k=60", "$k = 60$ (canonical setting)", "rrf", (k: 60), "early placements accumulate"),
      ),
    ),
    (
      id: "coverage-division",
      family: "Coverage division",
      note: none,
      stacks: (
        make-stack("k=20", "$k = 20$", "avg", (k: 20), "normalize by returning-retriever coverage"),
      ),
    ),
    (
      id: "weighted",
      family: "Retriever weights",
      note: none,
      stacks: (
        make-stack(
          "w=(1,1,3)",
          "$w = (1, 1, 3)$, $k = 20$",
          "weighted",
          (k: 20, w: (1, 1, 3)),
          "retriever weights change each contribution",
        ),
      ),
    ),
    (
      id: "rbc",
      family: "Centroid / RBC",
      note: none,
      stacks: (make-stack("phi=0.7", "$phi = 0.7$", "rbc", (phi: 0.7), "geometric rank decay"),),
    ),
    (
      id: "isr",
      family: "ISR",
      note: none,
      stacks: (
        make-stack(
          "|d|Q(d)",
          "$S_(upright(\"ISR\")) = |d| thin Q(d)$",
          "isr",
          (:),
          "inverse-square rank with a coverage factor",
        ),
      ),
    ),
    (
      id: "log-rrf",
      family: "Logarithmic RRF",
      note: coincidence-note,
      stacks: (
        make-stack(
          "b=1",
          "$b = 1$, $B = 1\\/ln 2$, $k = 20$",
          "log",
          (k: 20, b: 1),
          "logarithmic coverage multiplier with reciprocal rank",
        ),
      ),
    ),
  ),
)

// ---------------------------------------------------------------------------
// Rendering. Every mark below is a grid cell, a box, a rule, or text. Nothing
// here reads a document id or a rank literal: the drawing is derived entirely
// from `fingerprint-data`, which is the same value the feature test verifies.
// ---------------------------------------------------------------------------
#let faint = luma(170)
#let hush = luma(120)

// Document identity is a letter badge, never a hue.
#let badge(id) = box(
  width: 9.5pt,
  height: 9.5pt,
  radius: 1pt,
  fill: luma(238),
  stroke: 0.4pt + ink,
  align(center + horizon, text(size: 7pt, weight: "bold", fill: ink)[#id]),
)

#let empty-slot() = box(width: 9.5pt, height: 9.5pt, align(center + horizon, line(
  length: 6pt,
  stroke: 0.4pt + faint,
)))

// The centre ballot: three ordered lists, rank 1 at the top, empty slots kept.
#let ballot-block() = {
  let header = ([],) + retrievers.map(retriever => align(center, stack(
    spacing: 1.5pt,
    box(width: 11pt, height: 2.6pt, fill: retriever.colour),
    text(size: 6.2pt, fill: hush)[#retriever.id],
  )))
  let rows = ()
  for slot in range(1, ballot-depth + 1) {
    rows.push(align(right, text(size: 6.2pt, fill: hush)[#slot]))
    for (index, _) in retrievers.enumerate() {
      let here = documents.find(document => document.ranks.at(index) == slot)
      rows.push(align(center, if here == none { empty-slot() } else { badge(here.id) }))
    }
  }
  block(width: 100%, stroke: 0.5pt + faint, inset: 5pt, radius: 2pt)[
    #align(center, text(size: 8.5pt, weight: "bold", fill: ink)[The ballot])
    #v(1pt)
    #align(center, text(size: 6.2pt, fill: hush)[rank 1 at the top · every slot an integer])
    #v(4pt)
    #grid(
      columns: (auto, 1fr, 1fr, 1fr),
      row-gutter: 1.6pt,
      column-gutter: 2pt,
      ..header,
      ..rows
    )
    #v(4pt)
    #line(length: 100%, stroke: 0.3pt + faint)
    #v(3pt)
    #text(size: 6.6pt, fill: hush)[
      #for document in documents [
        #badge(document.id) #document.role. #linebreak()
      ]
      #v(1pt)
      Empty slots hold documents outside this fixture.
    ]
  ]
}

// One strip per promoted document: three cells in retriever order, each
// carrying that document's integer rank or a dash, outlined in retriever hue.
#let pattern-glyph(triple) = grid(
  columns: (auto, auto, auto),
  column-gutter: 1.5pt,
  ..triple
    .enumerate()
    .map(((index, rank)) => box(
      width: 11pt,
      height: 9.5pt,
      radius: 1pt,
      stroke: 0.6pt + retrievers.at(index).colour,
      align(center + horizon, text(size: 6.4pt, fill: ink)[#if rank == none [—] else [#rank]]),
    ))
)

// Family outcome is position plus an explicit ordinal numeral. A tie prints
// "=" on each tied row and the next group skips to its true position, so a tie
// never leaves a blank podium row.
#let medal-stack(groups) = {
  let rows = ()
  let position = 1
  for group in groups {
    for id in group {
      rows.push(align(right, text(size: 6.6pt, fill: hush)[
        #position#if group.len() > 1 [=]
      ]))
      rows.push(badge(id))
    }
    position += group.len()
  }
  grid(columns: (auto, auto), column-gutter: 3pt, row-gutter: 2pt, ..rows)
}

#let stack-block(entry) = [
  #text(size: 6.4pt, fill: hush)[#eval(entry.display, mode: "markup")]
  #v(2pt)
  #grid(
    columns: (auto, 1fr),
    column-gutter: 6pt,
    align(top, medal-stack(entry.groups)),
    align(horizon, stack(spacing: 2.5pt, ..entry.pattern.map(pattern-glyph))),
  )
]

#let fingerprint-panel(panel) = block(
  width: 100%,
  stroke: 0.4pt + faint,
  inset: 5pt,
  radius: 2pt,
)[
  #text(size: 7.6pt, weight: "bold", fill: ink)[#panel.family]
  #v(2.5pt)
  #for (index, entry) in panel.stacks.enumerate() {
    if index > 0 { v(4pt) }
    stack-block(entry)
  }
  // The mechanism phrase describes the family, so it prints once per panel even
  // when the panel nests two constants.
  #v(3pt)
  #text(size: 6.2pt, fill: hush, style: "italic")[#panel.stacks.first().phrase]
  #if panel.note != none [
    #v(2.5pt)
    #text(size: 6pt, fill: hush)[#eval(panel.note, mode: "markup")]
  ]
]

// Exactly one horizontal connector per panel, and the six panels occupy six
// distinct vertical bands, so no two connectors can cross.
#let connector() = line(length: 100%, stroke: 0.6pt + luma(150))

#let panel-column(panels, side) = stack(
  spacing: 5pt,
  ..panels.map(panel => grid(
    columns: if side == "left" { (1fr, 8pt) } else { (8pt, 1fr) },
    align: horizon,
    ..if side == "left" {
      (fingerprint-panel(panel), connector())
    } else {
      (connector(), fingerprint-panel(panel))
    }
  ))
)

#let all-groups(family, params) = top-groups(documents, family, params, take: documents.len())

#let ordinal(groups, id) = {
  for (index, group) in groups.enumerate() {
    if id in group { return index + 1 }
  }
  panic("document missing from policy")
}

#let policy-colours = (
  H: rgb("#2563eb"),
  D: rgb("#b45309"),
  B: rgb("#15803d"),
  S: rgb("#6d28d9"),
  C: rgb("#b91c1c"),
)

#let ranking-figure() = block(width: 100%)[
  #set text(fill: ink)
  #text(size: 8pt, weight: "bold")[Policy flow through one ballot]
  #text(size: 7pt, fill: hush)[Each line follows a document as the scoring policy changes. Crossings are changes in rank; the two trajectories that meet at a tick are ties.]
  #v(2pt)
  #lq.diagram(
    width: 100%,
    height: 8.5cm,
    xlim: (0.7, 7.3),
    ylim: (0.5, 5.5),
    xaxis: (ticks: (1, 2, 3, 4, 5, 6, 7)),
    yaxis: (ticks: (1, 2, 3, 4, 5)),
    xlabel: [RRF 20 · RRF 60 · average · weighted · RBC · ISR · logarithmic RRF],
    ylabel: [final position],
    grid: (stroke: 0.25pt + luma(220)),
    legend: (position: top + right),
    ..documents.map(document => {
      let policy-stacks = (
        (family: "rrf", params: (k: 20)),
        (family: "rrf", params: (k: 60)),
        (family: "avg", params: (k: 20)),
        (family: "weighted", params: (k: 20, w: (1, 1, 3))),
        (family: "rbc", params: (phi: 0.7)),
        (family: "isr", params: (:)),
        (family: "log", params: (k: 20, b: 1)),
      )
      let colour = policy-colours.at(document.id)
      lq.plot(
        range(1, policy-stacks.len() + 1).map(float),
        policy-stacks.map(policy => ordinal(all-groups(policy.family, policy.params), document.id)),
        color: colour,
        stroke: 1.5pt + colour,
        label: raw(document.id),
      )
    }),
  )
  #v(2pt)
  #align(center, text(size: 7pt, fill: hush)[The two RRF columns isolate rank damping; the final column reaches the $k=60$ order through logarithmic coverage weighting instead.])
]
