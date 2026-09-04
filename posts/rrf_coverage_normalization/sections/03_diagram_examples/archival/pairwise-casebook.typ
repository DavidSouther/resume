#import "@preview/lilaq:0.6.0" as lq

// Figure 1: the pairwise casebook.
//
// This module owns the figure's mathematics. Every number the figure prints is
// the return value of one of the score functions below, applied to a card's
// integer-rank fixture. No score is typed as a literal anywhere in this file.
//
// The score definitions follow sections/03_mathematical_formulation.md exactly.
// `ranks` is the multiset {r_i(d) : i in I_d} of a document's integer ranks;
// its length is the coverage n(d).

// S_RRF(d) = sum_{i in I_d} 1 / (k + r_i(d))
#let rrf-score(ranks, k) = ranks.fold(0.0, (total, rank) => total + 1.0 / (k + rank))

// S_avg(d) = S_RRF(d) / n(d)
#let coverage-division-score(ranks, k) = rrf-score(ranks, k) / ranks.len()

// S_RBC(d; phi) = sum_{i in I_d} q_phi(r_i(d)), with q_phi(r) = (1 - phi) phi^(r-1).
#let rbc-score(ranks, phi) = ranks.fold(0.0, (total, rank) => total + (1 - phi) * calc.pow(phi, rank - 1))

// The singleton-normalizing subfamily B = 1 / ln(1 + b), expressed as a multiplier.
#let singleton-normalized-log-multiplier(coverage, b) = calc.ln(coverage + b) / calc.ln(1 + b)

// The logN ISR coverage factor ln(n + sigma).
#let logn-isr-coverage-factor(coverage, sigma) = calc.ln(coverage + sigma)

// S_w(d) = sum_{i in I_d} w_i / (k + r_i(d)). Each placement is a (rank, weight) pair.
#let weighted-score(placements, k) = placements.fold(
  0.0,
  (total, placement) => total + placement.at(1) / (k + placement.at(0)),
)

// Q_ISR(d) = sum_{i in I_d} 1 / r_i(d)^2
#let isr-q(ranks) = ranks.fold(0.0, (total, rank) => total + 1.0 / calc.pow(rank, 2))

// S_ISR(d) = n(d) Q_ISR(d)
#let isr-score(ranks) = ranks.len() * isr-q(ranks)

// S_logISR(d) = ln(n(d)) Q_ISR(d)
#let log-isr-score(ranks) = calc.ln(ranks.len()) * isr-q(ranks)

// S_logNISR(d; sigma) = ln(n(d) + sigma) Q_ISR(d)
#let logn-isr-score(ranks, sigma) = logn-isr-coverage-factor(ranks.len(), sigma) * isr-q(ranks)

// S_log(d; b, B) = B S_RRF(d) ln(n(d) + b)
#let log-rrf-score(ranks, k, b, B) = B * rrf-score(ranks, k) * calc.ln(ranks.len() + b)

#let ink = rgb("#1f2937")

// Retrievers are fixed figure-wide, so a document's slot array indexes positionally
// and `none` marks a retriever that did not return the document.
#let retrievers = ("bm25", "dense", "splade")
#let weight-vector = (2.0, 1.0, 1.0)

#let ranks-of(slots) = slots.filter(slot => slot != none)

// Pair each present rank with its retriever's weight. A leading-dot method chain must not
// be split across lines here: Typst would end the `let` expression at the first newline.
#let placements-of(slots, weights) = {
  let placements = ()
  for (index, rank) in slots.enumerate() {
    if rank != none { placements.push((rank, weights.at(index))) }
  }
  placements
}

// The six cards. Each varies exactly one thing, holds the rest fixed, and states the
// general condition that its single selected case instantiates. Fixtures and constants
// are fixed by the session's research; no score is written here, only computed.
#let cards = (
  (
    id: "base-rrf",
    family: "Base RRF",
    question: "Does one top placement outrank two mid-ranked placements?",
    held: "ranks fixed",
    varied: "k, from 20 to 60",
    documents: (pinpoint: (1, none, none), twin: (none, 25, 25)),
    arms: (
      (label: "k=20", score: slots => rrf-score(ranks-of(slots), 20)),
      (label: "k=60", score: slots => rrf-score(ranks-of(slots), 60)),
    ),
    verdict: "reversal",
    condition: "A document at rank 1 ties two equal-rank results when r = k + 2. The range from 23 to 61 therefore flips as k moves from 20 to 60.",
  ),
  (
    id: "coverage-division",
    family: "Coverage division",
    question: "Does repeating the same evidence add anything?",
    held: "k=60, ranks fixed",
    varied: "the divisor |d|",
    documents: (pinpoint: (1, none, none), echo: (1, 1, 1), consensus: (5, 5, 5)),
    arms: (
      (label: "S_RRF", score: slots => rrf-score(ranks-of(slots), 60)),
      (label: "S_avg", score: slots => coverage-division-score(ranks-of(slots), 60)),
    ),
    verdict: "reversal, and an exact tie",
    condition: "With equal ranks, S_avg = 1/(k+r) for any coverage n >= 1. Three matching results therefore have the same average score as one.",
  ),
  (
    id: "retriever-weights",
    family: "Fixed retriever weights",
    question: "Whose evidence counts for more when the ranks are equal?",
    held: "k=60, ranks fixed; every document a singleton",
    varied: "the weights, from (1,1,1) to (2,1,1)",
    documents: (house: (5, none, none), equal-echo: (none, 5, none), better: (none, none, 3)),
    arms: (
      (label: "w=(1,1,1)", score: slots => rrf-score(ranks-of(slots), 60)),
      (label: "w=(2,1,1)", score: slots => weighted-score(placements-of(slots, weight-vector), 60)),
    ),
    verdict: "tie broken, and a reversal",
    condition: "S_w is linear in each w_i. At the same rank, documents follow the retriever weights. All of these documents appear in only one list.",
  ),
  (
    id: "rbc",
    family: "Rank-Biased Centroid",
    question: "How fast should the value of a rank fall away?",
    held: "ranks fixed",
    varied: "the rank kernel, from 1/(k+r) at k=60 to q(r) at phi=0.6",
    documents: (head-hit: (1, none, none), near-pair: (none, 8, 8)),
    arms: (
      (label: "S_RRF", score: slots => rrf-score(ranks-of(slots), 60)),
      (label: "S_RBC", score: slots => rbc-score(ranks-of(slots), 0.6)),
    ),
    verdict: "reversal",
    condition: "From rank 1 to rank 8, the reciprocal kernel at k=60 falls by a factor of 1.11; the geometric kernel falls by 35.7. That difference in decay changes the order.",
  ),
  (
    id: "isr",
    family: "ISR",
    question: "What happens when coverage is counted twice?",
    held: "ranks fixed",
    varied: "the kernel, from 1/(k+r) at k=60 to n/r^2",
    documents: (sharp: (1, none, none), pair: (2, 2, none), trio: (3, 3, 3)),
    arms: (
      (label: "S_RRF", score: slots => rrf-score(ranks-of(slots), 60)),
      (label: "S_ISR", score: slots => isr-score(ranks-of(slots))),
    ),
    verdict: "exact three-way tie",
    condition: "At equal ranks, S_ISR = n^2/r^2. When r = n, the score is 1, so all three documents tie.",
    footnote-sigma: 0.01,
  ),
  (
    id: "logarithmic-rrf",
    family: "Logarithmic RRF",
    question: "What does the coverage multiplier do to a lone strong placement?",
    held: "k=60, ranks fixed",
    varied: "b, from 0 to the default 1",
    documents: (quality: (1, none, none), rival: (none, 50, none), consensus: (12, 12, 12)),
    arms: (
      (label: "b=0, B=1", score: slots => log-rrf-score(ranks-of(slots), 60, 0, 1)),
      // The manuscript's named default S_1(d) = S_RRF(d) ln(n(d)+1) / ln 2, written as the
      // singleton-normalized multiplier at b=1 rather than as a separate constant.
      (
        label: "b=1, B=1/ln 2",
        score: slots => (
          rrf-score(ranks-of(slots), 60) * singleton-normalized-log-multiplier(ranks-of(slots).len(), 1)
        ),
      ),
    ),
    verdict: "tie broken",
    condition: "At b=0, ln 1 = 0, so every singleton receives a score of zero. B only rescales the scores; b causes the change in order.",
  ),
)

// Apply a score function across a card's documents, keyed by document id.
#let score-map(documents, score) = {
  let scores = (:)
  for (id, slots) in documents { scores.insert(id, score(slots)) }
  scores
}

// The record published for query. Functions are stripped; only computed data remains.
#let card-record(card) = {
  let record = (
    id: card.id,
    family: card.family,
    question: card.question,
    held: card.held,
    varied: card.varied,
    condition: card.condition,
    verdict: card.verdict,
    documents: card.documents,
    arms: card.arms.map(arm => (label: arm.label, scores: score-map(card.documents, arm.score))),
  )
  if "footnote-sigma" in card {
    let sigma = card.footnote-sigma
    record.insert(
      "footnote",
      (
        S_logISR: score-map(card.documents, slots => log-isr-score(ranks-of(slots))),
        S_logNISR: score-map(card.documents, slots => logn-isr-score(ranks-of(slots), sigma)),
      ),
    )
  }
  record
}

// --- Presentation ---------------------------------------------------------
//
// One meaning per channel. Colour identifies a retriever and nothing else, and every
// retriever also carries a shape mark so colour is never the sole carrier. Document
// identity is a letter badge plus a name. Outcome is position, an arrow, and `=`.

#let muted = luma(105)
#let rule-colour = luma(180)
#let retriever-styles = (
  bm25: (colour: rgb("#1d4ed8"), mark: sym.circle.filled),
  dense: (colour: rgb("#b45309"), mark: sym.triangle.filled.t),
  splade: (colour: rgb("#0f766e"), mark: sym.square.filled),
)

// Typst's `str` drops trailing zeros, so an exact 1 would print as "1" and card 5's
// three-way identity would look like a rendering fault. Pad to a fixed width instead.
#let fmt-score(value, digits: 4) = {
  let rounded = calc.round(value, digits: digits)
  let text-value = str(rounded)
  let parts = text-value.split(".")
  let whole = parts.at(0)
  let fraction = if parts.len() > 1 { parts.at(1) } else { "" }
  whole + "." + fraction + "0" * (digits - fraction.len())
}

// Group documents into shared positions, best first. Exact ties share one position and
// are ordered by name, so the rendered order never depends on dictionary order.
#let rank-groups(scores) = {
  let entries = scores.pairs().sorted(key: entry => (-entry.at(1), entry.at(0)))
  let groups = ()
  for entry in entries {
    if groups.len() > 0 and calc.abs(groups.last().at(0).at(1) - entry.at(1)) < 1e-12 {
      groups.last().push(entry)
    } else {
      groups.push((entry,))
    }
  }
  groups
}

#let doc-badge(id) = box(
  inset: (x: 2pt, y: 1pt),
  radius: 1pt,
  fill: luma(238),
  text(size: 6.5pt, weight: "bold", upper(id.at(0))),
)

#let doc-label(id) = [#doc-badge(id) #text(size: 7pt, id)]

// A card's miniature retriever receipt: integer placements only, em dash for absence.
#let receipt(documents) = table(
  columns: (auto, auto, auto, auto, auto),
  align: (left, center, center, center, center),
  inset: (x: 3pt, y: 2pt),
  stroke: none,
  table.header(
    text(size: 7pt, fill: muted)[document],
    ..retrievers.map(name => {
      let style = retriever-styles.at(name)
      text(size: 7pt, fill: style.colour)[#style.mark #name]
    }),
    text(size: 7pt, fill: muted)[$n$],
  ),
  table.hline(stroke: 0.4pt + rule-colour),
  ..documents
    .pairs()
    .map(entry => (
      doc-label(entry.at(0)),
      ..entry.at(1).map(rank => if rank == none { text(size: 7pt, fill: muted)[---] } else { text(size: 7pt)[#rank] }),
      text(size: 7pt, fill: muted)[#ranks-of(entry.at(1)).len()],
    ))
    .flatten(),
)

// One outcome arm: the documents in final order, one position per line, ties sharing a
// position and joined by `=`. Exact scores sit in a right-aligned audit column; they are
// short numeric labels beside an ordinal, never a length on a common scale.
#let outcome-arm(label, scores) = grid(
  columns: (1.35cm, 1fr),
  column-gutter: 3pt,
  align: (right + top, left + top),
  text(size: 7pt, fill: muted, raw(label)),
  grid(
    columns: (auto, 1fr, auto),
    column-gutter: 3pt,
    row-gutter: 2pt,
    align: (right + top, left + top, right + top),
    // One row per document. Documents sharing a position are continuation rows marked `=`,
    // so a tie stays visible in a narrow column instead of silently wrapping.
    ..rank-groups(scores)
      .enumerate()
      .map(entry => {
        let position = entry.at(0) + 1
        let group = entry.at(1)
        group.enumerate().map(member => (
          if member.at(0) == 0 {
            text(size: 7pt, fill: muted)[#position.]
          } else { box(inset: (y: 1pt), text(size: 7pt, weight: "bold")[=]) },
          doc-label(member.at(1).at(0)),
          if member.at(0) == 0 {
            text(size: 6.5pt, fill: muted, fmt-score(group.at(0).at(1)))
          } else { [] },
        ))
      })
      .flatten(),
  ),
)

#let casebook-card(index, card) = block(
  width: 100%,
  inset: 5pt,
  radius: 2pt,
  stroke: 0.5pt + rule-colour,
  {
    set par(justify: false, leading: 0.5em)
    text(size: 8pt, weight: "bold")[#index. #card.family]
    linebreak()
    text(size: 7pt, style: "italic")[#card.question]
    v(3pt)
    receipt(card.documents)
    v(2pt)
    text(size: 7pt, fill: muted)[fixed: #card.held #sym.dot.c changed: #card.varied]
    v(3pt)
    for (position, arm) in card.arms.enumerate() {
      outcome-arm(arm.label, arm.scores)
      if position == 0 { align(center, text(size: 7pt, fill: muted)[#sym.arrow.b]) }
    }
    v(2pt)
    text(size: 7pt, weight: "bold")[#card.verdict]
    if "footnote" in card {
      v(2pt)
      let line-for(name, scores) = {
        let ordered = card.documents.pairs().map(entry => [#entry.at(0) #fmt-score(scores.at(entry.at(0)))])
        text(size: 6.5pt, fill: muted)[#raw(name): #ordered.join([, ])]
      }
      line-for("S_logISR", card.footnote.S_logISR)
      linebreak()
      line-for("S_logNISR (sigma=0.01)", card.footnote.S_logNISR)
    }
    v(3pt)
    text(size: 7pt, fill: muted)[#card.condition]
  },
)

#let ordinal(scores, id) = {
  let groups = rank-groups(scores)
  for (index, group) in groups.enumerate() {
    if group.any(entry => entry.at(0) == id) { return index + 1 }
  }
  panic("document missing from score")
}

#let palette = (
  rgb("#2563eb"), rgb("#b45309"), rgb("#15803d"), rgb("#6d28d9"), rgb("#b91c1c"),
)

#let slope-panel(card, index) = {
  let left = card.arms.first()
  let right = card.arms.last()
  let ids = card.documents.keys().sorted()
  block(width: 100%)[
    #text(size: 8pt, weight: "bold")[#index. #card.family]
    #v(1pt)
    #text(size: 6.5pt, fill: muted)[#raw(left.label) #h(1fr) #sym.arrow.r #h(1fr) #raw(right.label)]
    #v(1pt)
    #lq.diagram(
      width: 100%,
      height: 3.2cm,
      xlim: (-0.1, 1.1),
      ylim: (0.5, ids.len() + 0.5),
      xaxis: (ticks: (0, 1)),
      grid: (stroke: 0.25pt + luma(225)),
      ..ids.enumerate().map(entry => {
        let id = entry.at(1)
        let colour = palette.at(calc.rem(entry.at(0), palette.len()))
        lq.plot(
          (0.0, 1.0),
          (ordinal(left.scores, id), ordinal(right.scores, id)),
          color: colour,
          stroke: 1.4pt + colour,
          label: raw(id),
        )
      }),
    )
    #text(size: 6.5pt, fill: muted)[#card.condition]
  ]
}

#let ranking-figure() = {
  set text(fill: ink)
  let records = cards.map(card-record)
  for record in records [#metadata(record)<casebook-card>]
  grid(
    columns: (1fr, 1fr, 1fr),
    rows: (auto, auto),
    column-gutter: 8pt,
    row-gutter: 8pt,
    ..records.enumerate().map(entry => slope-panel(entry.at(1), entry.at(0) + 1)),
  )
}
