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

local function chunk_size(column_count)
  if column_count >= 6 then
    return 1
  end
  return 4
end

local function render_table_chunk(head_rows, body_rows, foot_rows, column_count)
  local column_spec = string.rep(">{\\raggedright\\arraybackslash}X", column_count)
  local lines = {
    "\\begin{table*}[t]",
    "\\scriptsize",
    "\\setlength{\\tabcolsep}{4pt}",
    "\\renewcommand{\\arraystretch}{1.05}",
    "\\begin{tabularx}{\\textwidth}{@{}" .. column_spec .. "@{}}",
    "\\toprule",
  }

  if head_rows then
    for _, row in ipairs(head_rows) do
      table.insert(lines, render_row(row))
    end
    table.insert(lines, "\\midrule")
  end

  for _, row in ipairs(body_rows) do
    table.insert(lines, render_row(row))
  end

  if foot_rows then
    for _, row in ipairs(foot_rows) do
      table.insert(lines, render_row(row))
    end
  end

  table.insert(lines, "\\bottomrule")
  table.insert(lines, "\\end{tabularx}")
  table.insert(lines, "\\end{table*}")

  return table.concat(lines, "\n")
end

function Table(tbl)
  local column_count = #tbl.colspecs
  if column_count == 0 then
    return nil
  end

  local head_rows = tbl.head and tbl.head.rows or {}
  local body_rows = rows_from_bodies(tbl.bodies)
  local foot_rows = tbl.foot and tbl.foot.rows or {}
  local size = chunk_size(column_count)
  local chunks = {}

  for start = 1, #body_rows, size do
    local chunk = {}
    for index = start, math.min(start + size - 1, #body_rows) do
      table.insert(chunk, body_rows[index])
    end
    table.insert(
      chunks,
      render_table_chunk(head_rows, chunk, start + size > #body_rows and foot_rows or {}, column_count)
    )
  end

  return pandoc.RawBlock("latex", table.concat(chunks, "\n\n"))
end
