#let content-to-string(content) = {
  if content.has("text") { content.text
  } else if content.has("children") { content.children.map(content-to-string).join("")
  } else if content.has("body") { content-to-string(content.body) }
}

// Pandoc serializes this exact authored title without the spaces at its inline boundaries.
// Keep its display readable without changing the Markdown metadata.
#let display-title(title) = {
  if content-to-string(title) == "Position:Agentic LLM Workflows as Trajectory-Steering onManifolds in Document Spaces" {
    [Position: Agentic LLM Workflows as Trajectory‑Steering#linebreak()on Manifolds in Document Spaces]
  } else {
    title
  }
}

#let conf(
  title: none,
  authors: (),
  date: none,
  abstract-title: none,
  abstract: none,
  margin: (x: 0.68in, y: 0.7in),
  paper: "us-letter",
  lang: "en",
  region: "US",
  fontsize: 11pt,
  pagenumbering: "1",
  doc,
) = {
  set document(title: title)
  set page(paper: paper, margin: margin, numbering: pagenumbering, columns: 2)
  set columns(gutter: 0.25in)
  set text(font: "Libertinus Serif", size: 10pt, lang: lang, region: region)
  set par(justify: true, leading: 0.78em)
  show heading: set text(weight: "bold")
  show raw: set text(font: "JetBrains Mono", size: 0.85em)
  // Tables retain Pandoc's semantic header and use only booktabs-like rules.
  show figure.where(kind: table): it => {
    set table(
      inset: (x: 3pt, y: 2pt),
      align: left + top,
      row-gutter: 1em,
      stroke: none,
    )
    set par(justify: false, leading: 0.45em)
    set text(font: "Libertinus Serif", size: 7.5pt)
    place(top, float: true, scope: "parent", clearance: 3mm, block(width: 100%)[#it])
  }
  show figure.where(kind: table): set figure.caption(position: bottom)

  if title != none {
    place(top, float: true, scope: "parent", clearance: 4mm, block(below: 1.4em, width: 100%)[
      #align(center, block[
        #text(weight: "bold", size: 1.35em, hyphenate: false)[#display-title(title)]
      ])
      #if authors != none and authors != [] {
        let ncols = calc.min(authors.len(), 3)
        grid(columns: (1fr,) * ncols, row-gutter: 0.45em, ..authors.map(author => align(center)[
          #text(weight: "bold")[#author.name] \
          #author.affiliation \
          #author.email
        ]))
      }
      #if date != none { align(center)[#block(inset: 0.45em)[#date]] }
      #if abstract != none {
        block(inset: (x: 0.4in, y: 0.55em))[#text(weight: "bold")[#abstract-title] #h(0.75em) #abstract]
      }
    ])
  }
  doc
}

#show: doc => conf(
$if(title)$
  title: [$title$],
$endif$
$if(author)$
  authors: (
$for(author)$
$if(author.name)$
    (name: [$author.name$], affiliation: [$author.affiliation$], email: [$author.email$]),
$else$
    (name: [$author$], affiliation: "", email: ""),
$endif$
$endfor$
  ),
$endif$
$if(date)$
  date: [$date$],
$endif$
$if(lang)$
  lang: "$lang$",
$endif$
$if(region)$
  region: "$region$",
$endif$
$if(abstract-title)$
  abstract-title: [$abstract-title$],
$endif$
$if(abstract)$
  abstract: [$abstract$],
$endif$
  pagenumbering: $if(page-numbering)$"$page-numbering$"$else$"1"$endif$,
  doc,
)

$body$

$if(citations)$
$for(nocite-ids)$
#cite(label("${it}"), form: none)
$endfor$
$if(csl)$
#set bibliography(style: "$csl$")
$elseif(bibliographystyle)$
#set bibliography(style: "$bibliographystyle$")
$endif$
$if(bibliography)$
#bibliography(($for(bibliography)$"$bibliography$"$sep$,$endfor$)$if(full-bibliography)$, full: true$endif$)
$endif$
$endif$
