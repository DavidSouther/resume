// The original ledger presentation, retained as an interim comparison artifact.
#import "order-ledger.typ": ledger-record, evidence-shelf, order-strips, ink

#let ranking-figure() = block(width: 100%, breakable: false)[
  #set text(fill: ink, hyphenate: false)
  #let record = ledger-record()
  #text(size: 8pt, weight: "bold")[Evidence ledger]
  #text(size: 7pt)[The interim table view: evidence first, then each rule's ordered shelf.]
  #v(4pt)
  #evidence-shelf()
  #v(7pt)
  #order-strips(record, true)
  #metadata(record)<rrf-order-ledger-interim>
]
