// Mermaid's db contract: collect what the parser produced, expose it to the
// renderer, and carry no state from one render into the next. `diagram.ts` hands
// mermaid a fresh instance per render through the getter pattern, so `clear()`
// exists for the common accessors rather than as the isolation mechanism.

import type { TraceModel } from "./model.ts";

const EMPTY: TraceModel = { frames: [], heap: [] };

export class TraceDb {
	private model: TraceModel = EMPTY;
	private diagramTitle = "";
	private accTitle = "";
	private accDescription = "";

	setModel(model: TraceModel): void {
		this.model = model;
		if (model.title && this.diagramTitle === "") {
			this.diagramTitle = model.title;
		}
	}

	getModel(): TraceModel {
		return this.model;
	}

	setDiagramTitle(value: string): void {
		this.diagramTitle = value;
	}

	getDiagramTitle(): string {
		return this.diagramTitle;
	}

	setAccTitle(value: string): void {
		this.accTitle = value;
	}

	getAccTitle(): string {
		return this.accTitle;
	}

	setAccDescription(value: string): void {
		this.accDescription = value;
	}

	getAccDescription(): string {
		return this.accDescription;
	}

	clear(): void {
		this.model = EMPTY;
		this.diagramTitle = "";
		this.accTitle = "";
		this.accDescription = "";
	}
}
