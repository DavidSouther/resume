import { toHTML as jiffdown } from "@davidsouther/jiffdown";

interface SlideDeckHead {
	title?: string;
	date?: string;
	summary?: string;
}

const SLIDE_MARKER = "---";
const COLUMN_MARKER = "+++";

function isFenceLine(line: string): boolean {
	return /^(```|~~~)/.test(line.trim());
}

function splitOutsideFences(markdown: string, marker: string): string[] {
	const chunks: string[][] = [[]];
	let inFence = false;
	for (const line of markdown.split(/\r?\n/)) {
		if (isFenceLine(line)) {
			inFence = !inFence;
		}
		if (!inFence && line.trim() === marker) {
			chunks.push([]);
			continue;
		}
		chunks[chunks.length - 1].push(line);
	}
	return chunks.map((lines) => lines.join("\n"));
}

const HEADING_LINE = /^#{1,6}\s+\S.*$/;

// A slide is a "section" slide (big centered heading, ready for a subheading)
// when it's just a heading, or a heading plus one more block that's either a
// second heading or a short plain-text line — anything with a list, code
// fence, blockquote, or a third block is real content instead.
function isSectionSlide(markdown: string): boolean {
	const blocks = markdown
		.trim()
		.split(/\n\s*\n/)
		.filter((block) => block.trim() !== "");
	if (blocks.length === 0 || blocks.length > 2) return false;

	const [heading, subheading] = blocks.map((block) => block.trim());
	if (!HEADING_LINE.test(heading) || heading.includes("\n")) return false;
	if (subheading === undefined) return true;
	if (HEADING_LINE.test(subheading) && !subheading.includes("\n")) {
		return true;
	}

	return (
		!/^#{1,6}\s/m.test(subheading) &&
		!/^[-*+]\s/m.test(subheading) &&
		!/^\d+\.\s/m.test(subheading) &&
		!/^>/m.test(subheading) &&
		!isFenceLine(subheading.split("\n")[0])
	);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function renderTitleSlide(head: SlideDeckHead): string {
	const title = head.title ? `<h1>${escapeHtml(head.title)}</h1>` : "";
	const date = head.date
		? `<time datetime="${escapeHtml(head.date)}">${escapeHtml(new Date(head.date).toLocaleDateString())}</time>`
		: "";
	const summary = head.summary ? `<p>${escapeHtml(head.summary)}</p>` : "";
	return `<section class="slide slide-title">${title}${date}${summary}</section>`;
}

// A leading heading on a content slide reads as a running title, styled and
// positioned separately (top-left) from the body that follows it — pulling it
// out of the first column keeps that position stable whether the rest of the
// slide is one column or several.
function extractLeadingHeading(markdown: string): {
	heading: string | null;
	rest: string;
} {
	const trimmed = markdown.trim();
	const firstBreak = trimmed.search(/\n\s*\n/);
	const firstBlock = (
		firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak)
	).trim();

	if (HEADING_LINE.test(firstBlock) && !firstBlock.includes("\n")) {
		const rest = firstBreak === -1 ? "" : trimmed.slice(firstBreak).trim();
		return { heading: firstBlock, rest };
	}
	return { heading: null, rest: markdown };
}

function renderSlideChunk(markdown: string): string {
	if (markdown.trim() === "") return "";

	if (isSectionSlide(markdown)) {
		return `<section class="slide slide-section">${jiffdown(markdown)}</section>`;
	}

	const { heading, rest } = extractLeadingHeading(markdown);
	const headingHtml = heading
		? `<div class="slide-heading">${jiffdown(heading)}</div>`
		: "";

	const columns = splitOutsideFences(rest, COLUMN_MARKER).filter(
		(chunk) => chunk.trim() !== "",
	);
	const columnHtml = (columns.length > 0 ? columns : [rest])
		.map((column) => `<div class="slide-column">${jiffdown(column)}</div>`)
		.join("");
	const columnCount = Math.max(columns.length, 1);

	return `<section class="slide slide-content">${headingHtml}<div class="slide-columns" style="--column-count:${columnCount}">${columnHtml}</div></section>`;
}

export function renderSlides(head: SlideDeckHead, markdown: string): string {
	const slides = splitOutsideFences(markdown, SLIDE_MARKER)
		.map(renderSlideChunk)
		.filter((html) => html !== "");

	return [renderTitleSlide(head), ...slides].join("");
}
