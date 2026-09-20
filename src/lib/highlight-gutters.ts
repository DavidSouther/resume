import hljs from "highlight.js";

export type HighlightGutterRelation =
	| { readonly kind: "independent" }
	| { readonly kind: "copy"; readonly source: string }
	| { readonly kind: "reference"; readonly source: string }
	| { readonly kind: "mutable-reference"; readonly source: string };

export interface HighlightGutterMark {
	readonly name: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly move: boolean;
	readonly colorIndex: number;
	readonly relation: HighlightGutterRelation;
}

export interface HighlightGuttersSpec {
	readonly language: string;
	readonly sourceLines: readonly string[];
	readonly marks: readonly HighlightGutterMark[];
	readonly rejectedLines: ReadonlySet<number>;
}

function fenceError(message: string): Error {
	return new Error(`highlight-gutters: ${message}`);
}

function assertLineInBounds(
	line: number,
	lineCount: number,
	declaration: string,
): void {
	if (!Number.isSafeInteger(line) || line < 0 || line >= lineCount) {
		throw fenceError(
			`line ${line} is out of bounds in declaration \`${declaration}\` (source has ${lineCount} lines)`,
		);
	}
}

export function parseHighlightGutters(rawFence: string): HighlightGuttersSpec {
	const lines = rawFence.replaceAll("\r\n", "\n").split("\n");
	if (lines.at(-1) === "") lines.pop();

	const header = lines[0]?.match(/^code ([A-Za-z0-9_+-]+):$/);
	if (!header)
		throw fenceError("expected `code <language>:` as the first line");
	const language = header[1];
	if (!hljs.getLanguage(language)) {
		throw fenceError(`unknown highlight.js language \`${language}\``);
	}

	const marksHeaders = lines
		.map((line, index) => (line === "marks:" ? index : -1))
		.filter((index) => index >= 0);
	if (marksHeaders.length > 1) {
		throw fenceError("expected at most one unindented `marks:` header");
	}
	const marksIndex = marksHeaders[0] ?? lines.length;
	if (marksIndex === 1) throw fenceError("the code section must not be empty");
	if (lines.slice(1, marksIndex).some((line) => /^code .+:$/.test(line))) {
		throw fenceError("found a repeated code header");
	}

	const sourceLines = Object.freeze(lines.slice(1, marksIndex));
	if (sourceLines.length === 0)
		throw fenceError("the code section must not be empty");
	if (marksHeaders.length === 0) {
		return Object.freeze({
			language,
			sourceLines,
			marks: Object.freeze([]),
			rejectedLines: new Set<number>(),
		});
	}
	const declarations = lines.slice(marksIndex + 1);
	if (declarations.length === 0) throw fenceError("the marks section is empty");

	const marks: HighlightGutterMark[] = [];
	const rejectedLines = new Set<number>();
	const knownNames = new Set<string>();
	const identifier = "[A-Za-z_][A-Za-z0-9_]*";
	const range = "(\\d+),(\\d+)";

	for (const rawDeclaration of declarations) {
		const declaration = rawDeclaration.trim();
		if (declaration === "")
			throw fenceError("blank declaration in marks section");

		const rejection = declaration.match(/^reject (\d+)$/);
		if (rejection) {
			const line = Number(rejection[1]);
			assertLineInBounds(line, sourceLines.length, declaration);
			if (rejectedLines.has(line)) {
				throw fenceError(`repeated rejection for line ${line}`);
			}
			rejectedLines.add(line);
			continue;
		}

		const independent = declaration.match(
			new RegExp(`^(${identifier}) ${range}( move)?$`),
		);
		const copy = declaration.match(
			new RegExp(`^(${identifier}) copy (${identifier}) ${range}( move)?$`),
		);
		const reference = declaration.match(
			new RegExp(`^(${identifier}) &(${identifier}) ${range}( move)?$`),
		);
		const mutableReference = declaration.match(
			new RegExp(`^(${identifier}) &mut (${identifier}) ${range}( move)?$`),
		);

		let name: string;
		let startLine: number;
		let endLine: number;
		let move: boolean;
		let relation: HighlightGutterRelation;
		if (mutableReference) {
			name = mutableReference[1];
			relation = { kind: "mutable-reference", source: mutableReference[2] };
			startLine = Number(mutableReference[3]);
			endLine = Number(mutableReference[4]);
			move = Boolean(mutableReference[5]);
		} else if (reference) {
			name = reference[1];
			relation = { kind: "reference", source: reference[2] };
			startLine = Number(reference[3]);
			endLine = Number(reference[4]);
			move = Boolean(reference[5]);
		} else if (copy) {
			name = copy[1];
			relation = { kind: "copy", source: copy[2] };
			startLine = Number(copy[3]);
			endLine = Number(copy[4]);
			move = Boolean(copy[5]);
		} else if (independent) {
			name = independent[1];
			relation = { kind: "independent" };
			startLine = Number(independent[2]);
			endLine = Number(independent[3]);
			move = Boolean(independent[4]);
		} else {
			throw fenceError(`malformed declaration \`${declaration}\``);
		}

		if (knownNames.has(name)) throw fenceError(`duplicate mark \`${name}\``);
		if (relation.kind !== "independent" && !knownNames.has(relation.source)) {
			throw fenceError(
				`mark \`${name}\` refers to unknown or later source \`${relation.source}\``,
			);
		}
		assertLineInBounds(startLine, sourceLines.length, declaration);
		assertLineInBounds(endLine, sourceLines.length, declaration);
		if (startLine > endLine) {
			throw fenceError(
				`range starts after it ends in declaration \`${declaration}\``,
			);
		}

		knownNames.add(name);
		marks.push(
			Object.freeze({
				name,
				startLine,
				endLine,
				move,
				colorIndex: marks.length,
				relation: Object.freeze(relation),
			}),
		);
	}

	if (marks.length === 0) throw fenceError("the marks section has no marks");
	return Object.freeze({
		language,
		sourceLines,
		marks: Object.freeze(marks),
		rejectedLines,
	});
}

function escapeAttribute(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function markTokens(
	highlighted: string,
	marks: readonly HighlightGutterMark[],
): string {
	if (marks.length === 0) return highlighted;
	const marksByName = new Map(marks.map((mark) => [mark.name, mark]));
	const identifiers = marks
		.map((mark) => mark.name)
		.sort((left, right) => right.length - left.length)
		.join("|");
	const token = new RegExp(
		`(?<![A-Za-z0-9_])(${identifiers})(?![A-Za-z0-9_])`,
		"g",
	);
	const htmlEntity = /^&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);$/i;
	return highlighted
		.split(/(<[^>]+>|&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);)/gi)
		.map((part) => {
			if (part.startsWith("<") || htmlEntity.test(part)) return part;
			return part.replace(token, (name) => {
				const mark = marksByName.get(name);
				if (!mark) return name;
				return `<span class="highlight-gutter-token" data-gutter-token="${mark.name}" data-gutter-color="${mark.colorIndex}">${mark.name}</span>`;
			});
		})
		.join("");
}

function relationDescription(mark: HighlightGutterMark): string {
	switch (mark.relation.kind) {
		case "independent":
			return `${mark.name}, independent, lines ${mark.startLine} through ${mark.endLine}`;
		case "copy":
			return `${mark.name} copies ${mark.relation.source}, lines ${mark.startLine} through ${mark.endLine}`;
		case "reference":
			return `${mark.name} references ${mark.relation.source}, lines ${mark.startLine} through ${mark.endLine}`;
		case "mutable-reference":
			return `${mark.name} is a mutable reference to ${mark.relation.source}, lines ${mark.startLine} through ${mark.endLine}`;
	}
}

interface HighlightGutterLayout {
	readonly laneByName: ReadonlyMap<string, number>;
	readonly laneCount: number;
}

type ConnectedHighlightGutterMark = HighlightGutterMark & {
	readonly relation: Extract<
		HighlightGutterRelation,
		{ readonly kind: "reference" | "mutable-reference" }
	>;
};

function layoutHighlightGutterMarks(
	marks: readonly HighlightGutterMark[],
): HighlightGutterLayout {
	interface Group {
		readonly root: HighlightGutterMark;
		readonly references: ConnectedHighlightGutterMark[];
	}

	const groups: Group[] = [];
	const groupByMark = new Map<string, Group>();
	for (const mark of marks) {
		if (
			mark.relation.kind === "reference" ||
			mark.relation.kind === "mutable-reference"
		) {
			const group = groupByMark.get(mark.relation.source);
			if (!group)
				throw fenceError(`missing source \`${mark.relation.source}\``);
			group.references.push(mark as ConnectedHighlightGutterMark);
			groupByMark.set(mark.name, group);
			continue;
		}

		const group: Group = { root: mark, references: [] };
		groups.push(group);
		groupByMark.set(mark.name, group);
	}

	const laneByName = new Map<string, number>();
	let nextLane = 0;
	for (const group of groups) {
		const groupLaneByName = new Map<string, number>([[group.root.name, 0]]);
		const laneOccupants: HighlightGutterMark[][] = [[group.root]];

		for (const mark of group.references) {
			const sourceLane = groupLaneByName.get(mark.relation.source) ?? 0;
			let lane = sourceLane + 1;
			while (
				laneOccupants[lane]?.some(
					(occupant) =>
						mark.startLine <= occupant.endLine &&
						occupant.startLine <= mark.endLine,
				)
			) {
				lane += 1;
			}
			const occupants = laneOccupants[lane] ?? [];
			occupants.push(mark);
			laneOccupants[lane] = occupants;
			groupLaneByName.set(mark.name, lane);
		}

		for (const [name, groupLane] of groupLaneByName) {
			laneByName.set(name, nextLane + groupLane);
		}
		nextLane += laneOccupants.length;
	}

	return { laneByName, laneCount: nextLane };
}

export function renderHighlightGutters(spec: HighlightGuttersSpec): string {
	const description =
		spec.marks.length > 0
			? spec.marks.map(relationDescription).join("; ")
			: `Syntax-highlighted ${spec.language} source`;
	const layout = layoutHighlightGutterMarks(spec.marks);
	const connectedSourceNames = new Set(
		spec.marks.flatMap((mark) =>
			mark.relation.kind === "reference" ||
			mark.relation.kind === "mutable-reference"
				? [mark.relation.source]
				: [],
		),
	);
	const rows = spec.sourceLines
		.map((source, line) => {
			const bands = Array.from({ length: layout.laneCount }, (_, lane) => {
				const mark = spec.marks.find(
					(candidate) =>
						layout.laneByName.get(candidate.name) === lane &&
						line >= candidate.startLine &&
						line <= candidate.endLine,
				);
				if (!mark) {
					return '<span class="highlight-gutter-band-empty" aria-hidden="true"></span>';
				}
				const touching =
					mark.relation.kind === "reference" ||
					mark.relation.kind === "mutable-reference";
				const locked = spec.marks.some(
					(candidate) =>
						candidate.relation.kind === "mutable-reference" &&
						candidate.relation.source === mark.name &&
						line >= candidate.startLine &&
						line <= candidate.endLine,
				);
				const connectedSource = connectedSourceNames.has(mark.name);
				const classes = [
					"highlight-gutter-band",
					line === mark.startLine ? "highlight-gutter-start" : "",
					line === mark.endLine ? "highlight-gutter-end" : "",
					touching ? "highlight-gutter-touching" : "",
					mark.relation.kind === "mutable-reference"
						? "highlight-gutter-exclusive"
						: "",
					connectedSource ? "highlight-gutter-connected-source" : "",
					locked ? "highlight-gutter-locked" : "",
				]
					.filter(Boolean)
					.join(" ");
				const relation = mark.relation;
				const sourceData =
					relation.kind === "independent"
						? ""
						: ` data-gutter-source="${relation.source}"`;
				const terminal =
					mark.move && line === mark.endLine
						? '<span class="highlight-gutter-move-terminal" aria-hidden="true"></span>'
						: "";
				return `<span class="${classes}" data-gutter-band data-gutter-mark="${mark.name}" data-gutter-kind="${relation.kind}"${sourceData} data-gutter-color="${mark.colorIndex}" data-gutter-lane="${lane}" data-gutter-placement="${touching ? "touching" : "separate"}" data-start-line="${mark.startLine}" data-end-line="${mark.endLine}" data-line="${line}" aria-hidden="true">${terminal}</span>`;
			}).join("");
			const highlighted = hljs.highlight(source, {
				language: spec.language,
				ignoreIllegals: true,
			}).value;
			const rejected = spec.rejectedLines.has(line)
				? " highlight-gutter-rejected"
				: "";
			return `<span class="highlight-gutter-line${rejected}" data-line="${line}">${bands}<span class="highlight-gutter-source">${markTokens(highlighted, spec.marks)}</span></span>`;
		})
		.join("");

	return `<div class="highlight-gutters" role="group" aria-label="${escapeAttribute(description)}" style="--gutter-lanes: ${layout.laneCount}"><pre><code class="hljs language-${escapeAttribute(spec.language)}">${rows}</code></pre></div>`;
}

const HIGHLIGHT_GUTTER_FENCE =
	/<pre><code class="language-highlight-gutters">([\s\S]*?)<\/code><\/pre>/g;
const UNESCAPES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

export function rewriteHighlightGutterFences(html: string): string {
	return html.replace(HIGHLIGHT_GUTTER_FENCE, (_whole, body: string) => {
		const rawFence = body.replace(
			/&(?:amp|lt|gt|quot|#39);/g,
			(entity) => UNESCAPES[entity] ?? entity,
		);
		return renderHighlightGutters(parseHighlightGutters(rawFence));
	});
}
