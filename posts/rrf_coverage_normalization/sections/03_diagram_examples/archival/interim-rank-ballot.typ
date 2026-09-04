// The original ballot-and-fingerprint presentation, retained as an interim comparison artifact.
#import "rank-ballot.typ": fingerprint-data, ballot-block, panel-column, ink

#let ranking-figure() = block(width: 100%)[
  #set text(fill: ink)
  #let panels = fingerprint-data.panels
  #grid(
    columns: (1fr, 1.15fr, 1fr),
    column-gutter: 8pt,
    align: horizon,
    panel-column(panels.slice(0, 3), "left"),
    ballot-block(),
    panel-column(panels.slice(3), "right"),
  )
  #metadata(fingerprint-data)<rank-ballot-interim>
]
