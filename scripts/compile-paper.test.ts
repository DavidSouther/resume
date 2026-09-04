import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	compilePaper,
	createPaperPdfPaths,
	listPaperSections,
	observeSharedCompilerInvocationForTest,
} from "./compile-paper.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0))
		rmSync(directory, { force: true, recursive: true });
});

function temporaryPaperDir(): string {
	const directory = mkdtempSync(join(tmpdir(), "compile-paper-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("shared paper compiler", () => {
	it("derives all generated paths from the configured paper root", () => {
		const paths = createPaperPdfPaths({
			paperDir: "/paper",
			outputPdf: "/paper/build/out.pdf",
			typstSourceName: "generated.typ",
		});

		expect(paths).toMatchObject({
			paperDir: "/paper",
			sectionsDir: "/paper/sections",
			buildBibliography: "/paper/build/refs.bib",
			typstSource: "/paper/build/generated.typ",
			outputPdf: "/paper/build/out.pdf",
		});
	});

	it("discovers only direct Markdown sections in lexical order", () => {
		const paperDir = temporaryPaperDir();
		const sectionsDir = join(paperDir, "sections");
		mkdirSync(join(sectionsDir, "nested"), { recursive: true });
		writeFileSync(join(sectionsDir, "02_second.md"), "");
		writeFileSync(join(sectionsDir, "01_first.md"), "");
		writeFileSync(join(sectionsDir, "nested", "03_nested.md"), "");
		writeFileSync(join(sectionsDir, "notes.txt"), "");

		expect(
			listPaperSections(
				createPaperPdfPaths({
					paperDir,
					outputPdf: join(paperDir, "build", "out.pdf"),
					typstSourceName: "out.typ",
				}),
			),
		).toEqual([
			join(sectionsDir, "01_first.md"),
			join(sectionsDir, "02_second.md"),
		]);
	});

	it("removes its test observer cleanly", () => {
		const observer = vi.fn();
		const stopObserving = observeSharedCompilerInvocationForTest(observer);
		const config = {
			paperDir: "/missing-paper",
			outputPdf: "/missing-paper/build/out.pdf",
			typstSourceName: "out.typ",
		};

		expect(() => compilePaper(config)).toThrow(
			"required paper asset is missing",
		);
		expect(observer).toHaveBeenCalledWith({
			paperDir: "/missing-paper",
			outputPdf: "/missing-paper/build/out.pdf",
		});
		stopObserving();
		observer.mockClear();
		expect(() => compilePaper(config)).toThrow(
			"required paper asset is missing",
		);

		expect(observer).not.toHaveBeenCalled();
	});
});
