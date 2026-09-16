// The mermaid ExternalDiagramDefinition. `mermaid.registerExternalDiagrams`
// takes these; the loader only runs once a detector has matched, so the diagram
// implementation stays out of the initial payload.

const id = "traceDiagram";

/** Anchored to the start, so prose or a node label mentioning the word cannot match. */
export const detector = (text: string): boolean =>
	/^\s*traceDiagram(?:\s|$)/.test(text);

export const loader = async () => {
	const { diagram } = await import("./diagram.ts");
	return { id, diagram };
};

export const traceDiagram = { id, detector, loader };

export default traceDiagram;
