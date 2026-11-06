"""Wikipedia election pages (MediaWiki parse API JSON with `prop=wikitext|revid`) to candidate rows.

Results are read from the `{{Election box ...}}` templates, which carry party, candidate, and vote fields on every page from 2008 on.
When a statewide page's general election box has no vote counts yet, the counts of the nominees in the page's infobox are used and the
race is noted as partial. A race with no counts anywhere is reported by name and never written as zeros.
"""

import re
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, cast

from .medsl import senate_class
from .model import AT_LARGE_STATES, LATEST_CYCLE, STATE_CODES, CandidateRow, Office, Party, Round, SourceFormatError, State
from .names import normalize_name

STATE_PATTERN = "|".join(sorted((re.escape(name) for name in STATE_CODES), key=len, reverse=True))
GOVERNOR_TITLE = re.compile(rf"^(\d{{4}}) ({STATE_PATTERN}) gubernatorial (special )?election$")
SENATE_TITLE = re.compile(rf"^(\d{{4}}) United States Senate (special )?elections? in ({STATE_PATTERN})$")
HOUSE_TITLE = re.compile(rf"^(\d{{4}}) United States House of Representatives elections? in ({STATE_PATTERN})$")
LINE_TEMPLATES = ("election box candidate", "election box winning candidate", "election box write-in", "election box none of these candidates")
DISTRICT_IN_TITLE = re.compile(r"(\d+)(?:st|nd|rd|th) congressional district", re.I)
DISTRICT_HEADING = re.compile(r"^District (\d+)$", re.I)
UNWRAPPED_TEMPLATES = {"nowrap", "nobold", "small", "big", "nts", "ntsh", "nowr", "sort", "abbr"}


@dataclass(frozen=True)
class BoxLine:
    candidate: str
    party_label: str
    votes: int | None
    incumbent: bool


@dataclass(frozen=True)
class ElectionBox:
    title: str
    headings: tuple[str, ...]  # the enclosing section headings, outermost first
    lines: tuple[BoxLine, ...]
    text: str  # the raw template text, for status words such as "certified"


@dataclass(frozen=True)
class _Race:
    year: int
    state: State
    office: Office
    seat: int
    special: bool
    name: str  # for the load report, such as "2018 GA governor"


class _Unreadable(Exception):
    pass


def page_title(payload: dict[str, Any]) -> str:
    """The resolved page title, or raises SourceFormatError naming the API error."""
    parse = payload.get("parse")
    if not isinstance(parse, dict) or not isinstance(cast("dict[str, Any]", parse).get("title"), str):
        error = payload.get("error")
        info = cast("dict[str, Any]", error).get("info", "no parse result") if isinstance(error, dict) else "no parse result"
        raise SourceFormatError("Wikipedia", str(info))
    return str(cast("dict[str, Any]", parse)["title"])


def page_wikitext(payload: dict[str, Any]) -> str:
    page_title(payload)
    text = cast("dict[str, Any]", payload["parse"]).get("wikitext")
    if not isinstance(text, str):
        raise SourceFormatError("Wikipedia", "the parse result has no wikitext")
    return text


def _source(payload: dict[str, Any]) -> str:
    parse = cast("dict[str, Any]", payload["parse"])
    revid = parse.get("revid")
    return f"Wikipedia: {parse['title']}" + (f" (revid {revid})" if revid else "")


def _templates(text: str, prefix: str) -> Iterator[tuple[int, str]]:
    """Each template whose name starts with `prefix` (case insensitive), as its start offset and its inner text, nesting respected."""
    lowered = text.lower()
    i = 0
    while True:
        i = lowered.find("{{", i)
        if i < 0:
            return
        name = lowered[i + 2 : i + 2 + 80].lstrip()
        if name.startswith(prefix):
            end = _match_braces(text, i)
            yield i, text[i + 2 : end - 2]
            i = end
        else:
            i += 2


def _match_braces(text: str, start: int) -> int:
    depth = 0
    i = start
    while i < len(text) - 1:
        pair = text[i : i + 2]
        if pair == "{{":
            depth += 1
            i += 2
        elif pair == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                return i
        else:
            i += 1
    return len(text)


def _params(inner: str) -> tuple[str, dict[str, str]]:
    """A template's name and its named parameters, split on the pipes outside nested templates and links."""
    parts = _split_top(inner)
    named: dict[str, str] = {}
    for part in parts[1:]:
        if "=" in part:
            key, value = part.split("=", 1)
            named[key.strip().lower()] = value.strip()
    return parts[0].strip(), named


def _split_top(inner: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    i = 0
    while i < len(inner):
        pair = inner[i : i + 2]
        if pair in ("{{", "[["):
            depth += 1
            current.append(pair)
            i += 2
            continue
        if pair in ("}}", "]]"):
            depth -= 1
            current.append(pair)
            i += 2
            continue
        if inner[i] == "|" and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(inner[i])
        i += 1
    parts.append("".join(current))
    return parts


def _headings(wikitext: str) -> list[tuple[int, int, str]]:
    return [(m.start(), len(m.group(1)), clean(m.group(2))) for m in re.finditer(r"^(={2,6})\s*(.*?)\s*\1\s*$", wikitext, re.M)]


def _enclosing(headings: list[tuple[int, int, str]], offset: int) -> tuple[str, ...]:
    stack: list[tuple[int, str]] = []
    for start, level, text in headings:
        if start > offset:
            break
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, text))
    return tuple(text for _, text in stack)


def election_boxes(wikitext: str) -> list[ElectionBox]:
    """Every election box on the page, in page order, with the section headings around it."""
    headings = _headings(wikitext)
    boxes: list[ElectionBox] = []
    current: tuple[int, str, list[BoxLine]] | None = None
    end_of_current = 0

    def close(stop: int) -> None:
        if current is not None:
            start, title, lines = current
            boxes.append(ElectionBox(title, _enclosing(headings, start), tuple(lines), wikitext[start:stop]))

    for start, inner in _templates(wikitext, "election box"):
        name, params = _params(inner)
        lowered = name.lower()
        if lowered.startswith("election box begin"):
            close(start)
            current = (start, clean(params.get("title", "")), [])
        elif lowered.startswith("election box end"):
            close(start + len(inner) + 4)
            current = None
        elif current is not None and lowered.startswith(LINE_TEMPLATES):
            current[2].append(_line(lowered, params))
            end_of_current = start + len(inner) + 4
    close(end_of_current)
    return boxes


def _line(name: str, params: dict[str, str]) -> BoxLine:
    raw = params.get("candidate", "")
    if name.startswith("election box write-in"):
        raw = raw or "Write-in"
    elif name.startswith("election box none of these"):
        raw = "None of these candidates"
    incumbent = bool(re.search(r"\([^)]*\bincumbent\b[^)]*\)", clean(_first_of_ticket(raw)), re.I))
    return BoxLine(_candidate_name(raw), clean(params.get("party", "")), _votes(params.get("votes", "")), incumbent)


def _candidate_name(raw: str) -> str:
    """The candidate's own name. A joint ticket (a list template, a line break, or a slash) is named by its first member, the governor."""
    text = clean(_first_of_ticket(raw))
    text = re.sub(r"\([^)]*\b(?:incumbent|withdrew|withdrawn|write-in|deceased)\b[^)]*\)", "", text, flags=re.I)
    text = re.sub(r"\[\w{1,2}\]", "", text)  # rendered footnote markers such as [a]
    return " ".join(text.split()).strip(" ,")


def _first_of_ticket(raw: str) -> str:
    stripped = raw.strip()
    m = re.match(r"\{\{\s*(ubl|unbulleted list|plainlist|plain list|flatlist)\s*\|", stripped, re.I)
    if m:
        items = [part.strip().lstrip("*").strip() for part in _split_top(stripped[2 : _match_braces(stripped, 0) - 2])[1:]]
        items = [item for part in items for item in part.split("\n") if item.strip("* ")]
        return items[0].lstrip("* ") if items else ""
    return re.split(r"<br\s*/?>|\s/\s|\n\s*\*", clean(stripped) if stripped.startswith("{{") else stripped, flags=re.I)[0]


def _votes(raw: str) -> int | None:
    text = clean(raw).replace(",", "").replace("\u00a0", "")
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


def clean(text: str) -> str:
    """Wiki markup to plain text: refs, comments, and bold or italic quotes removed, links to their labels, wrapper templates unwrapped."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref[^>/]*/>", "", text, flags=re.I)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.I | re.S)
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"\{\{([^{}]*)\}\}", _unwrap_template, text)
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("'''", "").replace("''", "").replace("&nbsp;", " ")
    return " ".join(text.split())


def _unwrap_template(m: re.Match[str]) -> str:
    parts = [p.strip() for p in m.group(1).split("|")]
    name = parts[0].lower()
    args = [p for p in parts[1:] if "=" not in p]
    if name.startswith("formatnum:"):
        return parts[0].split(":", 1)[1]
    if name == "sortname" and len(args) >= 2:
        return f"{args[0]} {args[1]}"
    if name in UNWRAPPED_TEMPLATES and args:
        return args[0]
    return ""


def party_of(label: str) -> Party:
    """A Wikipedia party label or party article title as DEM, REP, or OTHER. State affiliates such as Minnesota's DFL count as DEM."""
    lowered = label.lower()
    if re.search(r"democratic[-\u2013\s]+(farmer|npl|nonpartisan)", lowered):
        return "DEM"
    if re.search(r"social democrat|democratic socialist|democratic-republican|democratic\u2013republican|christian democrat", lowered):
        return "OTHER"
    if re.match(r"^(democratic|democrat)\b", lowered):
        return "DEM"
    if re.match(r"^republican\b", lowered):
        return "REP"
    return "OTHER"


def state_from_title(title: str) -> State | None:
    for pattern, group in ((GOVERNOR_TITLE, 2), (SENATE_TITLE, 3), (HOUSE_TITLE, 2)):
        m = pattern.match(title)
        if m:
            return STATE_CODES[m.group(group)]
    return None


def _linked_titles(payload: dict[str, Any], pattern: re.Pattern[str], year: int) -> list[str]:
    found: dict[str, None] = {}
    for m in re.finditer(r"\[\[([^\]|#]+)", page_wikitext(payload)):
        title = " ".join(m.group(1).replace("_", " ").split())
        match = pattern.match(title)
        if match and int(match.group(1)) == year:
            found[title] = None
    return list(found)


def governor_titles(payload: dict[str, Any], year: int) -> list[str]:
    """The state race pages linked from a "YYYY United States gubernatorial elections" overview, territories and recalls left out."""
    return _linked_titles(payload, GOVERNOR_TITLE, year)


def senate_titles(payload: dict[str, Any], year: int) -> list[str]:
    """The state race pages linked from a "YYYY United States Senate elections" overview, specials included."""
    return _linked_titles(payload, SENATE_TITLE, year)


def house_titles(year: int) -> list[str]:
    """One page per state: "elections in" for multi district states and "election in" for at large states."""
    return [f"{year} United States House of Representatives {'election' if code in AT_LARGE_STATES else 'elections'} in {name}" for name, code in STATE_CODES.items()]


def parse_governor_page(payload: dict[str, Any], year: int, fetched_at: str) -> tuple[list[CandidateRow], list[str]]:
    """Returns the rows of one state's governor race page and the names of races whose tables could not be read or were read in part."""
    title = page_title(payload)
    m = GOVERNOR_TITLE.match(title)
    if not m or int(m.group(1)) != year:
        raise SourceFormatError(title, f"not a {year} state gubernatorial election page")
    race = _Race(year, STATE_CODES[m.group(2)], "governor", 0, bool(m.group(3)), "")
    race = _Race(race.year, race.state, race.office, race.seat, race.special, _race_name(race))
    return _statewide(payload, race, fetched_at)


def parse_2026_page(payload: dict[str, Any], office: Office, fetched_at: str) -> tuple[list[CandidateRow], list[str]]:
    """One state's Senate race page, or one state's House page with a race per district. The year comes from the title."""
    title = page_title(payload)
    if office == "senate":
        m = SENATE_TITLE.match(title)
        if not m:
            raise SourceFormatError(title, "not a state Senate election page")
        year, special, state = int(m.group(1)), bool(m.group(2)), STATE_CODES[m.group(3)]
        seat = senate_class(year, state, special, title)
        race = _Race(year, state, "senate", seat, special, "")
        return _statewide(payload, _Race(year, state, "senate", seat, special, _race_name(race)), fetched_at)
    if office == "house":
        m = HOUSE_TITLE.match(title)
        if not m:
            raise SourceFormatError(title, "not a state House elections page")
        return _house(payload, int(m.group(1)), STATE_CODES[m.group(2)], fetched_at)
    raise SourceFormatError(title, f"parse_2026_page does not read {office} pages")


def _race_name(race: _Race) -> str:
    seat = f" district {race.seat}" if race.office == "house" else ""
    return f"{race.year} {race.state} {race.office}{seat}{' special' if race.special else ''}"


def _statewide(payload: dict[str, Any], race: _Race, fetched_at: str) -> tuple[list[CandidateRow], list[str]]:
    """The general (and runoff) election boxes, or else the infobox nominees when the page has no general box or one without votes."""
    boxes = [b for b in election_boxes(page_wikitext(payload)) if not _about_other_office(b)]
    try:
        return _race_rows(boxes, race, payload, fetched_at), []
    except _Unreadable as e:
        general = _pick_general(boxes)
        if general is not None and any(line.votes is not None for line in general.lines if not _is_write_in(line)):
            return [], [f"{race.name}: {e}"]
        try:
            rows = _infobox_rows(payload, race, fetched_at)
        except _Unreadable as infobox_error:
            return [], [f"{race.name}: {e}; {infobox_error}"]
        return rows, [f"{race.name}: partial, {e}, so only the infobox nominees are counted"]


def _house(payload: dict[str, Any], year: int, state: State, fetched_at: str) -> tuple[list[CandidateRow], list[str]]:
    by_seat: dict[int, list[ElectionBox]] = defaultdict(list)
    for box in election_boxes(page_wikitext(payload)):
        seat = _district(box, state)
        if seat is not None:
            by_seat[seat].append(box)
    if not by_seat:
        return [], [f"{year} {state} house: no district election boxes on {page_title(payload)}"]
    rows: list[CandidateRow] = []
    skipped: list[str] = []
    for seat in sorted(by_seat):
        race = _Race(year, state, "house", seat, False, "")
        race = _Race(year, state, "house", seat, False, _race_name(race))
        try:
            rows += _race_rows(by_seat[seat], race, payload, fetched_at)
        except _Unreadable as e:
            skipped.append(f"{race.name}: {e}")
    return rows, skipped


def _district(box: ElectionBox, state: State) -> int | None:
    if state in AT_LARGE_STATES:
        return 0
    m = DISTRICT_IN_TITLE.search(box.title)
    if m:
        return int(m.group(1))
    if "at-large" in box.title.lower():
        return 0
    for heading in reversed(box.headings):
        hm = DISTRICT_HEADING.match(heading)
        if hm:
            return int(hm.group(1))
    return None


def _context(box: ElectionBox) -> str:
    return " ".join((box.title, *box.headings)).lower()


def _about_other_office(box: ElectionBox) -> bool:
    return "lieutenant" in _context(box)


def _is_primary(box: ElectionBox) -> bool:
    return any(word in _context(box) for word in ("primary", "convention", "caucus", "recall"))


def _is_blanket(box: ElectionBox) -> bool:
    return any(word in _context(box) for word in ("blanket", "jungle"))


def _is_runoff(box: ElectionBox) -> bool:
    return "runoff" in _context(box) or "run-off" in _context(box)


def _counted(box: ElectionBox) -> int:
    return sum(line.votes or 0 for line in box.lines)


def _pick_general(boxes: list[ElectionBox]) -> ElectionBox | None:
    generals = [b for b in boxes if b.lines and not _is_primary(b) and not _is_runoff(b)]
    if not generals:
        generals = [b for b in boxes if b.lines and _is_blanket(b) and not _is_runoff(b)]
    return max(generals, key=_counted) if generals else None


def _pick_runoff(boxes: list[ElectionBox]) -> ElectionBox | None:
    runoffs = [b for b in boxes if b.lines and _is_runoff(b) and not (_is_primary(b) and not _is_blanket(b))]
    return max(runoffs, key=_counted) if runoffs else None


def _race_rows(boxes: list[ElectionBox], race: _Race, payload: dict[str, Any], fetched_at: str) -> list[CandidateRow]:
    general = _pick_general(boxes)
    if general is None:
        raise _Unreadable("no general election box")
    rows = _box_rows(general, "general", race, payload, fetched_at)
    runoff = _pick_runoff(boxes)
    if runoff is not None and _counted(runoff) > 0:
        rows += _box_rows(runoff, "runoff", race, payload, fetched_at)
    return rows


def _is_write_in(line: BoxLine) -> bool:
    return line.candidate.lower().startswith("write-in")


def _box_rows(box: ElectionBox, round_: Round, race: _Race, payload: dict[str, Any], fetched_at: str) -> list[CandidateRow]:
    lines = [line for line in box.lines if not (_is_write_in(line) and line.votes is None)]
    if not lines:
        raise _Unreadable(f"the {round_} election box lists no candidates")
    missing = [line.candidate or "(unnamed)" for line in lines if line.votes is None]
    if missing:
        raise _Unreadable(f"the {round_} election box has no votes for {', '.join(missing)}")
    unofficial = race.year >= LATEST_CYCLE and "certified" not in box.text.lower()
    return _merge(lines, round_, race, _source(payload), fetched_at, unofficial)


def _merge(lines: list[BoxLine], round_: Round, race: _Race, source: str, fetched_at: str, unofficial: bool) -> list[CandidateRow]:
    """Sums the party lines of a fusion candidate. A "Total" line repeats those lines, so it marks incumbency but adds no votes."""
    groups: dict[str, list[BoxLine]] = defaultdict(list)
    for line in lines:
        groups[line.candidate.casefold()].append(line)
    counted = {key: [line for line in group if line.party_label.lower() != "total"] for key, group in groups.items()}
    total = sum(line.votes or 0 for group in counted.values() for line in group)
    if total <= 0:
        raise _Unreadable(f"the {round_} election box counts no votes")
    rows: list[CandidateRow] = []
    for key, group in groups.items():
        parts = counted[key] or group
        votes = sum(line.votes or 0 for line in parts)
        rows.append(
            CandidateRow(
                year=race.year,
                state=race.state,
                office=race.office,
                seat=race.seat,
                special=race.special,
                round=round_,
                candidate=normalize_name(group[0].candidate),
                party=_major_party(parts),
                votes=votes,
                total_votes=total,
                pct=round(100.0 * votes / total, 4),
                incumbent=any(line.incumbent for line in group),
                unofficial=unofficial,
                source=source,
                fetched_at=fetched_at,
            )
        )
    return rows


def _major_party(lines: list[BoxLine]) -> Party:
    by_party: dict[Party, int] = defaultdict(int)
    for line in lines:
        by_party[party_of(line.party_label)] += line.votes or 0
    majors: list[tuple[int, Party]] = [(votes, party) for party, votes in by_party.items() if party != "OTHER"]
    return max(majors)[1] if majors else "OTHER"


def _infobox_rows(payload: dict[str, Any], race: _Race, fetched_at: str) -> list[CandidateRow]:
    infobox = next(_templates(page_wikitext(payload), "infobox election"), None)
    if infobox is None:
        raise _Unreadable("no infobox")
    _, params = _params(infobox[1])
    lines: list[BoxLine] = []
    for n in range(1, 10):
        nominee = params.get(f"nominee{n}") or params.get(f"candidate{n}")
        if not nominee:
            continue
        lines.append(BoxLine(_candidate_name(nominee), clean(params.get(f"party{n}", "")), _votes(params.get(f"popular_vote{n}", "")), False))
    if not lines:
        raise _Unreadable("the infobox lists no nominees")
    missing = [line for line in lines if line.votes is None]
    if any(party_of(line.party_label) != "OTHER" for line in missing) or len(missing) == len(lines):
        raise _Unreadable(f"the infobox has no votes for {', '.join(line.candidate for line in missing)}")
    lines = [line for line in lines if line.votes is not None]  # a minor nominee without a count is left out, as the note says
    return _merge(lines, "general", race, _source(payload) + ", infobox", fetched_at, race.year >= LATEST_CYCLE)


def governor_incumbent(payload: dict[str, Any]) -> tuple[tuple[int, State, bool], str, Party] | None:
    """The governor holding office going into the race, from the infobox `before_election` and `before_party` fields.

    Returns the race key (year, state, special), the officeholder's name, and party, or None when the page is not a governor race page
    or its infobox names no officeholder.
    """
    m = GOVERNOR_TITLE.match(page_title(payload))
    if not m:
        return None
    infobox = next(_templates(page_wikitext(payload), "infobox election"), None)
    if infobox is None:
        return None
    _, params = _params(infobox[1])
    name = clean(params.get("before_election", ""))
    if not name:
        return None
    return (int(m.group(1)), STATE_CODES[m.group(2)], bool(m.group(3))), name, party_of(clean(params.get("before_party", "")))
