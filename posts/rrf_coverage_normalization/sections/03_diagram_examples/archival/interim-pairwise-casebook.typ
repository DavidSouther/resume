// The original casebook-card presentation, retained as an interim comparison artifact.
#import "pairwise-casebook.typ": cards, card-record, casebook-card, ink

#let ranking-figure() = {
  set text(fill: ink)
  let records = cards.map(card-record)
  for record in records [#metadata(record)<casebook-card-interim>]
  grid(
    columns: (1fr, 1fr, 1fr),
    rows: (auto, auto),
    column-gutter: 8pt,
    row-gutter: 8pt,
    ..records.enumerate().map(entry => casebook-card(entry.at(0) + 1, entry.at(1))),
  )
}
