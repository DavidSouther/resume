import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { getPost, getSortedPosts } from "../posts.ts";
import { parseTrace } from "./parse.ts";

const POST_ID = "memory_diagrams_papers_mermaid";
const POST_PATH = join(cwd(), "posts", `${POST_ID}.md`);
const MERMAID_FENCE = /```mermaid\n([\s\S]*?)```/g;
const SOURCE_FENCE = /```(python|java|cpp)\n([\s\S]*?)```/g;

function figures(section: string): { numbers: number[]; diagrams: string[] } {
	return {
		numbers: [...section.matchAll(/^### Figure (\d+):/gm)].map((match) =>
			Number(match[1]),
		),
		diagrams: [...section.matchAll(MERMAID_FENCE)].map((match) => match[1]),
	};
}

describe("the two paper diagram galleries", () => {
	it("keeps the post hidden while covering all 6 + 9 source figures", async () => {
		const source = readFileSync(POST_PATH, "utf-8");
		const post = matter(source);
		const sections = post.content.split(/^## 2021 paper:/m);
		const from2016 = figures(sections[0]);
		const from2021 = figures(sections[1] ?? "");
		const figure8Section =
			(sections[1] ?? "").match(
				/^### Figure 8:[\s\S]*?(?=^### Figure 9:)/m,
			)?.[0] ?? "";

		expect(post.data.show).toBe(false);
		expect(getSortedPosts().map(({ id }) => id)).not.toContain(POST_ID);
		expect(post.content).toContain("https://doi.org/10.1145/2839509.2844607");
		expect(post.content).toContain("https://doi.org/10.1145/3430665.3456317");

		expect(from2016.numbers).toEqual([1, 2, 3, 4, 5, 6]);
		expect(from2016.diagrams).toHaveLength(6);
		expect(from2021.numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(from2021.diagrams).toHaveLength(9);
		expect([...from2016.diagrams, ...from2021.diagrams]).toHaveLength(15);

		// Source-derived landmarks keep the gallery's load-bearing execution
		// history and call relationships from collapsing into final-state sketches.
		expect(sections[0]).toContain(
			"Memory Diagrams: A Consistant Approach Across Concepts and Languages",
		);
		expect(from2016.diagrams[2]).toContain("0: 5, 0");
		expect(from2016.diagrams[2]).not.toContain("watch numbers[0]");
		expect(from2016.diagrams[4]).toMatch(
			/frame SavingsAccount\.getInfo[\s\S]*baseInfo:[\s\S]*frame Account\.getInfo[\s\S]*ret ID Jane Doe \| Balance 100\.0 -> baseInfo/,
		);
		expect(from2016.diagrams[5]).toContain("value: ~20~");
		expect(from2016.diagrams[5]).not.toContain("deleted");
		expect(from2016.diagrams[5]).not.toContain("watch allocated cell");
		expect(from2021.diagrams[2]).toContain("0: 19, 20");
		expect(from2021.diagrams[2]).toContain("1: 17, 18");
		expect(from2021.diagrams[2]).toContain("2: 21, 22");
		expect(from2021.diagrams[2]).not.toMatch(/\(was /);
		expect(from2021.diagrams[7]).toContain("stackPtr [0x24]: &0x20");
		expect(from2021.diagrams[7]).toContain("heapPtr [0x32]: @dynamic-int");
		expect(from2021.diagrams[7]).toContain("value: 30, 40");
		expect(from2021.diagrams[7]).not.toContain("watch dynamic-int value");
		expect(figure8Section).toMatch(
			/current `traceDiagram` syntax records that[\s\S]*relation as the text `&0x20` rather than drawing an arrow/,
		);
		const sourceListings = [...post.content.matchAll(SOURCE_FENCE)];
		expect(sourceListings).toHaveLength(15);
		expect(sourceListings.map((match) => match[1])).toEqual([
			"python",
			"python",
			"python",
			"python",
			"java",
			"cpp",
			"python",
			"python",
			"python",
			"python",
			"python",
			"java",
			"cpp",
			"cpp",
			"cpp",
		]);
		expect(sourceListings[0]?.[2]).toContain('s = "hello"');
		expect(sourceListings[4]?.[2]).toContain(
			"class SavingsAccount extends Account",
		);
		expect(sourceListings[5]?.[2]).toContain("int* heapPtr = new int;");
		expect(sourceListings[6]?.[2]).toContain("ageDays = ageYears * 365");
		expect(sourceListings[9]?.[2]).toContain('p1 = Person("Seth", 7)');
		expect(sourceListings[11]?.[2]).toContain(
			"public static int calcTot(List<int> numList)",
		);
		expect(sourceListings[14]?.[2]).toContain(
			"int* heapArrayPtr = new int[2];",
		);

		const body = (await getPost(POST_ID)).body ?? "";
		const renderedFigures = [
			...body.matchAll(/<figure class="trace-figure">([\s\S]*?)<\/figure>/g),
		];
		expect(renderedFigures).toHaveLength(15);
		for (const [, renderedFigure] of renderedFigures) {
			expect(renderedFigure).toMatch(
				/<pre><code class="hljs language-(?:python|java|cpp)">/,
			);
			expect(renderedFigure).toContain('<pre class="mermaid">');
		}

		for (const diagram of [...from2016.diagrams, ...from2021.diagrams]) {
			expect(diagram).not.toMatch(/^\s+row\s/m);
			expect(() => parseTrace(diagram)).not.toThrow();
		}
	});
});
