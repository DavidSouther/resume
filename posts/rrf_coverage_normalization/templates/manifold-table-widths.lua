-- Pandoc owns the Markdown-to-Typst transformation. This style-layer filter
-- changes only Table 1's column measures before Typst is generated; it never
-- rewrites generated Typst or the Markdown source.
function Table(table)
  if #table.colspecs == 5 then
    table.colspecs[1][1] = pandoc.AlignLeft
    table.colspecs[1][2] = 0.16
    table.colspecs[2][1] = pandoc.AlignLeft
    table.colspecs[2][2] = 0.16
    table.colspecs[3][1] = pandoc.AlignLeft
    table.colspecs[3][2] = 0.19
    table.colspecs[4][1] = pandoc.AlignLeft
    table.colspecs[4][2] = 0.23
    table.colspecs[5][1] = pandoc.AlignLeft
    table.colspecs[5][2] = 0.26
  end
  return table
end
