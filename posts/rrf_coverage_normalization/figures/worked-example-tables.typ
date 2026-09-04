#let small-cell(body) = align(center + horizon, text(size: 5.6pt)[#body])
#let left-cell(body) = align(left + horizon, text(size: 5.6pt)[#body])

#let worked-example-tables() = figure(
  grid(
    columns: (2fr, 0.86fr),
    column-gutter: 10pt,
    align: top,
    block(width: 100%)[
      #text(size: 7pt, weight: "bold")[Document rank positions and scores]
      #v(3pt)
      #table(
        columns: (0.22fr, 0.84fr, 0.64fr, 0.3fr, 0.26fr, 0.46fr, 0.54fr, 0.38fr, 0.52fr, 0.34fr, 0.48fr),
        inset: (x: 1.1pt, y: 1.8pt),
        align: center + horizon,
        stroke: none,
        table.header(
          small-cell([ID]), left-cell([Title]), left-cell([Media]), small-cell([lexical]), small-cell([text]), small-cell([multimodal]), small-cell([$S_(upright("RRF"))$]), small-cell([$S_w$]), small-cell([$S_(upright("ISR"))$]), small-cell([$S_1$]), small-cell([$S_"sat"$]),
        ),
        table.hline(stroke: 0.4pt),
        small-cell([A]), left-cell([Installation \ guide]), left-cell([text & image]), small-cell([4]), small-cell([4]), small-cell([4]), small-cell([0.046]), small-cell([0.015]), small-cell([0.562]), small-cell([0.093]), small-cell([0.133]),
        small-cell([B]), left-cell([Program \ FAQ]), left-cell([text]), small-cell([1]), small-cell([—]), small-cell([—]), small-cell([0.016]), small-cell([0.007]), small-cell([1.000]), small-cell([0.016]), small-cell([0.013]),
        small-cell([C]), left-cell([Permitting \ checklist]), left-cell([text]), small-cell([2]), small-cell([2]), small-cell([—]), small-cell([0.032]), small-cell([0.012]), small-cell([1.000]), small-cell([0.051]), small-cell([0.067]),
        small-cell([D]), left-cell([Inspection \ guide]), left-cell([text & image]), small-cell([3]), small-cell([1]), small-cell([2]), small-cell([0.048]), small-cell([0.016]), small-cell([4.083]), small-cell([0.096]), small-cell([0.137]),
        small-cell([E]), left-cell([Report]), left-cell([PDF]), small-cell([5]), small-cell([5]), small-cell([5]), small-cell([0.046]), small-cell([0.015]), small-cell([0.360]), small-cell([0.092]), small-cell([0.131]),
        small-cell([F]), left-cell([Wiring \ diagram]), left-cell([text & image]), small-cell([—]), small-cell([3]), small-cell([1]), small-cell([0.032]), small-cell([0.008]), small-cell([2.222]), small-cell([0.051]), small-cell([0.067]),
        small-cell([G]), left-cell([Stock \ photo]), left-cell([image]), small-cell([—]), small-cell([—]), small-cell([3]), small-cell([0.015]), small-cell([0.003]), small-cell([0.111]), small-cell([0.015]), small-cell([0.013]),
        table.hline(stroke: 0.4pt),
      )
    ],
    block(width: 100%)[
      #text(size: 7pt, weight: "bold")[Resulting document order]
      #v(3pt)
      #table(
        columns: (0.36fr, 1fr),
        inset: (x: 2pt, y: 2.4pt),
        align: (center + horizon, left + horizon),
        stroke: none,
        table.header(small-cell([Method]), left-cell([Document order])),
        table.hline(stroke: 0.4pt),
        small-cell([$S_(upright("RRF"))$]), left-cell([D > A > E > F > C > B > G]),
        small-cell([$S_w$]), left-cell([D > A > E > C > F > B > G]),
        small-cell([$S_(upright("ISR"))$]), left-cell([D > F > B = C > A > E > G]),
        small-cell([$S_1$]), left-cell([D > A > E > F > C > B > G]),
        small-cell([$S_(upright("sat"))$]), left-cell([D > A > E > F > C > B > G]),
        table.hline(stroke: 0.4pt),
      )
    ],
  ),
  kind: table,
  supplement: [Table],
  caption: [Ranking source documents for the query "How do I inspect an installation?". Three retrievers, lexical, text, and multimodal, list the rank within each retriever. An emdash indicates that retriever did not rank that document. The numerical score for each fusion method is listed to three decimals; further tiesbreakers are discussed below. On the right, a summary table of the final ranking from each method.],
)
