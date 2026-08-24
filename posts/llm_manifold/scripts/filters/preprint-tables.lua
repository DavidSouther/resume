-- Pandoc's default LaTeX table output sets column widths from the source
-- markdown's character counts, which leaves the prose columns of Table 1 too
-- narrow to read. This renders every table as a full-width tabularx instead.
local function trim(text)
  return text:gsub("^%s+", ""):gsub("%s+$", "")
end

local function latex_blocks(blocks)
  return trim(pandoc.write(pandoc.Pandoc(blocks), "latex"))
end

local function cell_latex(cell)
  local rendered = latex_blocks(cell.contents)
  rendered = rendered:gsub("\n\n+", "\\par ")
  rendered = rendered:gsub("\n", " ")
  return rendered
end

local function render_row(row)
  local cells = {}
  for _, cell in ipairs(row.cells) do
    table.insert(cells, cell_latex(cell))
  end
  return table.concat(cells, " & ") .. " \\\\"
end

local function rows_from_bodies(bodies)
  local rows = {}
  for _, body in ipairs(bodies) do
    for _, row in ipairs(body.body) do
      table.insert(rows, row)
    end
  end
  return rows
end

function Table(tbl)
  local column_count = #tbl.colspecs
  if column_count == 0 then
    return nil
  end

  local column_spec = string.rep(">{\\raggedright\\arraybackslash}X", column_count)
  local lines = {
    "\\begin{table}[t]",
    "\\small",
    "\\setlength{\\tabcolsep}{4pt}",
    "\\renewcommand{\\arraystretch}{1.05}",
    "\\begin{tabularx}{\\textwidth}{@{}" .. column_spec .. "@{}}",
    "\\toprule",
  }

  for _, row in ipairs(tbl.head and tbl.head.rows or {}) do
    table.insert(lines, render_row(row))
  end
  table.insert(lines, "\\midrule")

  for _, row in ipairs(rows_from_bodies(tbl.bodies)) do
    table.insert(lines, render_row(row))
  end

  for _, row in ipairs(tbl.foot and tbl.foot.rows or {}) do
    table.insert(lines, render_row(row))
  end

  table.insert(lines, "\\bottomrule")
  table.insert(lines, "\\end{tabularx}")
  table.insert(lines, "\\end{table}")

  return pandoc.RawBlock("latex", table.concat(lines, "\n"))
end
