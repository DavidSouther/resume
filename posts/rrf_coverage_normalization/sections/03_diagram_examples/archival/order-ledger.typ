#import "@preview/lilaq:0.6.0" as lq

// Figure 1, the ordered-evidence ledger.
//
// One fixed body of integer retrieval evidence, and the document order that each
// of the paper's score families derives from it. This module owns the fixture,
// one transcription of each formula in sections/03_mathematical_formulation.md,
// the ordering those formulas imply, and the rendering of both halves.
//
// The figure has no axis, no surface, and no shared score scale. Every mark is a
// document badge at an ordinal position. There is deliberately no plotting
// package imported here: the "no continuous field" constraint is checkable only
// while this file stays free of one.
//
// Style note: a method chain may break across lines only inside a parenthesized
// group — its own parentheses, an argument list, or an array or dictionary literal.
// Outside one, a line break ends the expression and the rest of the chain is dropped
// silently, producing a plausible wrong value rather than an error.

// --- the shared fixture, the single source of truth --------------------------
//
// A rank is a one-based position in that retriever's full result list, so within
// one retriever every rank below is a distinct positive integer. Only these five
// documents are shown; the intervening positions hold documents not under study.

#let ledger-retrievers = (
  (id: "R1", label: "retriever 1", weight: 0.1),
  (id: "R2", label: "retriever 2", weight: 1.0),
  (id: "R3", label: "retriever 3", weight: 0.1),
)

#let ledger-documents = (
  (
    id: "P",
    name: "Pinpoint",
    role: "one first-place result",
    hue: rgb("#2563eb"),
    ranks: (R1: 1),
  ),
  (
    id: "T",
    name: "Twin signal",
    role: "two high placements",
    hue: rgb("#b45309"),
    ranks: (R1: 2, R2: 2),
  ),
  (
    id: "C",
    name: "Consensus",
    role: "agreement across all three",
    hue: rgb("#15803d"),
    ranks: (R1: 5, R2: 5, R3: 5),
  ),
  (
    id: "M",
    name: "Mixed evidence",
    role: "one high and two low placements",
    hue: rgb("#6d28d9"),
    ranks: (R1: 3, R2: 10, R3: 10),
  ),
  (
    id: "L",
    name: "Late consensus",
    role: "agreement far down the lists",
    hue: rgb("#b91c1c"),
    ranks: (R1: 20, R2: 20, R3: 20),
  ),
)

// k = 60 is the canonical rank constant and is held by every derived family.
// k = 20 is a tuned comparison and appears on the base strip alone.
#let ledger-parameters = (
  k-tuned: 20,
  k-canonical: 60,
  phi: 0.7,
  b: 1,
  big-b: 1.0 / calc.ln(2.0),
)

// Every reader of the fixture goes through this one filter, so a rank keyed to a
// retriever that the shelf does not list can never be scored while staying invisible
// in the rendered evidence.
#let supports-of(document) = (
  ledger-retrievers
    .filter(retriever => retriever.id in document.ranks)
    .map(retriever => (id: retriever.id, rank: document.ranks.at(retriever.id)))
)

#let ranks-of(document) = supports-of(document).map(support => support.rank)

#let coverage-of(document) = supports-of(document).len()

// --- one function per formula in the Mathematical Formulation section ---------

// S_RRF(d) = sum over supporting retrievers of 1 / (k + r_i(d)).
#let rrf-score(ranks, k) = ranks.fold(0.0, (total, rank) => total + 1.0 / (k + rank))

// S_avg(d) = S_RRF(d) / n(d).
#let coverage-division-score(ranks, k) = rrf-score(ranks, k) / ranks.len()

// S_w(d) = sum over supporting retrievers of w_i / (k + r_i(d)). This is the one
// score that needs retriever identity, so it takes supports rather than bare ranks.
#let weighted-score(supports, weights, k) = supports.fold(
  0.0,
  (total, support) => total + weights.at(support.id) / (k + support.rank),
)

// S_RBC(d; phi) = sum of q_phi(r), with q_phi(r) = (1 - phi) phi^(r - 1).
#let rbc-score(ranks, phi) = ranks.fold(
  0.0,
  (total, rank) => total + (1.0 - phi) * calc.pow(phi, rank - 1),
)

// S_ISR(d) = n(d) Q_ISR(d), with Q_ISR(d) = sum of 1 / r^2.
#let isr-score(ranks) = {
  let inverse-square = ranks.fold(0.0, (total, rank) => total + 1.0 / calc.pow(rank, 2))
  ranks.len() * inverse-square
}

// S_log(d; b, B) = B S_RRF(d) ln(n(d) + b).
#let log-rrf-score(ranks, k, b, big-b) = (
  big-b * rrf-score(ranks, k) * calc.ln(ranks.len() + b)
)

// --- the fixture, serialized ---------------------------------------------------
//
// Every strip records this string alongside its scores, so a reader of the
// published record can confirm that all seven consumed one shelf.

#let serialize-evidence() = (
  ledger-documents
    .map(document => {
      let supports = supports-of(document).map(support => (
        support.id + "=" + str(support.rank)
      ))
      document.id + ":" + supports.join(",")
    })
    .join("|")
)

// --- the seven strips ---------------------------------------------------------

#let ledger-weights = {
  let weights = (:)
  for retriever in ledger-retrievers {
    weights.insert(retriever.id, retriever.weight)
  }
  weights
}

#let ledger-strips = (
  (
    id: "rrf-k20",
    family: "Base RRF",
    parameters: "k = 20 (tuned comparison)",
    mechanism: "smaller k makes early ranks count more",
    score: document => rrf-score(ranks-of(document), ledger-parameters.k-tuned),
  ),
  (
    id: "rrf-k60",
    family: "Base RRF",
    parameters: "k = 60 (canonical setting)",
    mechanism: "larger k narrows the gap between ranks",
    score: document => rrf-score(ranks-of(document), ledger-parameters.k-canonical),
  ),
  (
    id: "coverage-division",
    family: "Coverage division",
    parameters: "k = 60",
    mechanism: "average reciprocal rank, rather than the total",
    score: document => coverage-division-score(
      ranks-of(document),
      ledger-parameters.k-canonical,
    ),
  ),
  (
    id: "weighted",
    family: "Retriever-weighted RRF",
    parameters: "k = 60, weights 0.1 / 1.0 / 0.1",
    mechanism: "each retriever contributes at its assigned weight",
    score: document => weighted-score(
      supports-of(document),
      ledger-weights,
      ledger-parameters.k-canonical,
    ),
  ),
  (
    id: "rbc",
    family: "Rank-Biased Centroid",
    parameters: "φ = 0.7",
    mechanism: "value drops geometrically with rank",
    score: document => rbc-score(ranks-of(document), ledger-parameters.phi),
  ),
  (
    id: "isr",
    family: "Inverse Square Rank",
    parameters: "no free parameter",
    mechanism: "inverse-square rank with an extra coverage factor",
    score: document => isr-score(ranks-of(document)),
  ),
  (
    id: "log-rrf",
    family: "Logarithmic RRF",
    parameters: "k = 60, b = 1, B = 1/ln 2",
    mechanism: "a logarithmic reward for additional support",
    score: document => log-rrf-score(
      ranks-of(document),
      ledger-parameters.k-canonical,
      ledger-parameters.b,
      ledger-parameters.big-b,
    ),
  ),
)

// Equality is exact on the values the formulas produced: a tie is printed only when
// the arithmetic ties, never because a rounding window was applied.
#let score-strip(strip) = {
  let scores = (:)
  for document in ledger-documents {
    scores.insert(document.id, (strip.score)(document))
  }
  let ranked = ledger-documents.map(document => document.id).sorted(
    key: id => (-scores.at(id), id),
  )
  let groups = ()
  for id in ranked {
    if groups.len() > 0 and scores.at(groups.last().last()) == scores.at(id) {
      let tied = groups.pop()
      tied.push(id)
      groups.push(tied)
    } else {
      groups.push((id,))
    }
  }
  (scores: scores, groups: groups.map(group => group.sorted()))
}

#let ledger-record() = {
  // Serialized once and handed to every strip, so "all seven scored one shelf" is
  // true by construction rather than by seven separate constructions agreeing.
  let evidence = serialize-evidence()
  (
    version: "order-ledger-1",
    retrievers: ledger-retrievers,
    documents: ledger-documents.map(document => (
      id: document.id,
      name: document.name,
      role: document.role,
      ranks: document.ranks,
    )),
    evidence: evidence,
    // Published as numbers, not only as label text, so a test can bind the constant
    // the arithmetic used to the constant the figure and caption claim.
    parameters: ledger-parameters,
    weights: ledger-weights,
    strips: ledger-strips.map(strip => {
      let derived = score-strip(strip)
      (
        id: strip.id,
        family: strip.family,
        parameters: strip.parameters,
        mechanism: strip.mechanism,
        evidence: evidence,
        groups: derived.groups,
        scores: derived.scores,
      )
    }),
  )
}

// --- rendering ------------------------------------------------------------------
//
// Colour carries exactly one meaning in this figure: document identity. Retrievers
// are told apart by column position and by their printed label, never by hue, so no
// two encodings compete. Every badge also prints its letter, which keeps the ledger
// readable in greyscale and for readers who cannot separate the hues.

#let ink = rgb("#1f2937")
#let muted = rgb("#6b7280")
#let hairline = 0.4pt + rgb("#9ca3af")
#let rule = 0.7pt + ink

#let document-by-id(id) = ledger-documents.find(document => document.id == id)

#let absent = "\u{2014}"

// Enough significant figures to audit the closest call on the shelf, which is
// coverage division separating P from T by 1.6 percent.
#let format-score(value) = {
  let digits = if value >= 1.0 { 3 } else if value >= 0.01 { 4 } else { 5 }
  str(calc.round(value, digits: digits))
}

// Typst prints an integral float without its fraction, which would show the middle
// retriever's weight as "1" beside the other two shown as "0.1".
#let format-weight(value) = {
  let printed = str(value)
  if printed.contains(".") { printed } else { printed + ".0" }
}

#let badge(document) = box(
  fill: document.hue,
  inset: (x: 3.4pt, y: 1.7pt),
  radius: 2pt,
  text(fill: white, weight: "bold", size: 7.5pt, document.id),
)

#let badge-run(group) = {
  let parts = ()
  for (index, id) in group.enumerate() {
    if index > 0 {
      parts.push(text(size: 8pt, fill: muted, weight: "bold")[#h(2.5pt)=#h(2.5pt)])
    }
    parts.push(badge(document-by-id(id)))
  }
  parts.join()
}

#let evidence-shelf() = {
  set text(size: 7.5pt, fill: ink)
  table(
    columns: (auto, ..(auto,) * (ledger-retrievers.len() + 1), 1fr),
    align: (
      left + horizon,
      ..(right + horizon,) * (ledger-retrievers.len() + 1),
      left + horizon,
    ),
    inset: (x: 5pt, y: 3pt),
    stroke: none,
    table.hline(stroke: rule),
    table.header(
      text(weight: "bold")[document],
      ..ledger-retrievers.map(retriever => align(right)[
        #text(weight: "bold")[#retriever.label] \
        #text(size: 6.5pt, fill: muted)[weight #format-weight(retriever.weight)]
      ]),
      align(right)[#text(weight: "bold")[coverage] \ #text(size: 6.5pt, fill: muted)[$|d|$]],
      text(weight: "bold")[role in the fixture],
    ),
    table.hline(stroke: hairline),
    ..ledger-documents
      .map(document => (
        [#badge(document) #h(2pt) #document.name],
        ..ledger-retrievers.map(retriever => if retriever.id in document.ranks {
          [#document.ranks.at(retriever.id)]
        } else {
          text(fill: muted)[#absent]
        }),
        [#coverage-of(document)],
        text(fill: muted)[#document.role],
      ))
      .flatten(),
    table.hline(stroke: rule),
  )
}

#let order-strips(record, show-scores) = {
  set text(size: 7.5pt, fill: ink)
  let ordinals = ("1st", "2nd", "3rd", "4th", "5th").slice(0, record.documents.len())
  let paired-run = record.strips.filter(strip => strip.family == record.strips.first().family).len()
  // Everything drawn below comes from the published record, never from a second
  // derivation, so the printed order cannot drift from the asserted one.
  let strip-row(strip) = {
    let label = [
      #text(weight: "bold")[#strip.family]
      #h(4pt)
      #text(size: 6.5pt)[#strip.parameters] \
      #text(size: 6.5pt, fill: muted)[#strip.mechanism]
    ]
    let slots = strip.groups.map(group => grid.cell(
      colspan: group.len(),
      align(center)[
        #badge-run(group) \
        #text(size: 6.5pt)[#group.map(id => document-by-id(id).name).join(" = ")]
        #if show-scores [
          \ #text(size: 6pt, fill: muted)[#group.map(id => format-score(strip.scores.at(id))).join(" = ")]
        ]
      ],
    ))
    (label, ..slots)
  }
  grid(
    columns: (2.05in, ..(1fr,) * ordinals.len()),
    inset: (x: 4pt, y: 4pt),
    align: (left + horizon, ..(center,) * ordinals.len()),
    // A rule under the header, and one under the leading same-family run, so the two
    // base-RRF rank constants read as one comparison rather than as two families.
    // Derived from the strip list, so reordering the strips moves the rule with them.
    stroke: (x, y) => (top: if y == 1 or y == paired-run + 1 { hairline }),
    grid.header(
      align(bottom + left)[#text(size: 6.5pt, fill: muted)[rule and settings]],
      ..ordinals.map(ordinal => align(center)[#text(size: 6.5pt, fill: muted, weight: "bold")[#ordinal]]),
    ),
    ..record.strips.map(strip-row).flatten(),
  )
}

#let ordinal(groups, id) = {
  for (index, group) in groups.enumerate() {
    if id in group { return index + 1 }
  }
  panic("document missing from an order")
}

#let ranking-figure() = block(width: 100%, breakable: false)[
  #set text(fill: ink, hyphenate: false)
  #let record = ledger-record()
  #text(size: 8pt, weight: "bold")[A. Evidence paths]
  #text(size: 7pt, fill: muted)[Each coloured path follows one document through the retrievers that returned it. Rank 1 is at the lower edge.]
  #v(2pt)
  #lq.diagram(
    width: 100%,
    height: 4.2cm,
    xlim: (0.7, 3.3),
    ylim: (0, 21),
    xaxis: (ticks: (1, 2, 3)),
    yaxis: (ticks: (1, 5, 10, 20)),
    ylabel: [source rank],
    grid: (stroke: 0.25pt + luma(220)),
    legend: (position: top + right),
    ..record.documents.map(document => {
      let source = document-by-id(document.id)
      let supports = supports-of(document)
      lq.plot(
        supports.map(support => if support.id == "R1" { 1.0 } else if support.id == "R2" { 2.0 } else { 3.0 }),
        supports.map(support => support.rank),
        color: source.hue,
        stroke: 1.25pt + source.hue,
        label: raw(document.name),
      )
    }),
  )
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 0pt,
    align(center, text(size: 7pt, fill: muted)[retriever 1]),
    align(center, text(size: 7pt, fill: muted)[retriever 2]),
    align(center, text(size: 7pt, fill: muted)[retriever 3]),
  )
  #v(7pt)
  #text(size: 8pt, weight: "bold")[B. Policy trajectories]
  #text(size: 7pt, fill: muted)[The same documents move through seven scoring rules. A crossing is an ordering reversal; the merged blue and orange paths are the ISR tie.]
  #v(2pt)
  #lq.diagram(
    width: 100%,
    height: 5.1cm,
    xlim: (0.7, 7.3),
    ylim: (0.5, 5.5),
    xaxis: (ticks: (1, 2, 3, 4, 5, 6, 7)),
    yaxis: (ticks: (1, 2, 3, 4, 5)),
    xlabel: [RRF 20 · RRF 60 · average · weighted · RBC · ISR · logarithmic RRF],
    ylabel: [final position],
    grid: (stroke: 0.25pt + luma(220)),
    legend: (position: top + right),
    ..record.documents.map(document => lq.plot(
      range(1, record.strips.len() + 1).map(float),
      record.strips.map(strip => ordinal(strip.groups, document.id)),
      color: document-by-id(document.id).hue,
      stroke: 1.35pt + document-by-id(document.id).hue,
      label: raw(document.name),
    )),
  )
  #metadata(record)<rrf-order-ledger>
]
