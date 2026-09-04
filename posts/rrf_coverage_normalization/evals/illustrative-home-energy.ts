export type RankerName = "lexical" | "text embedding" | "multimodal embedding";

export type FixtureDocument = Readonly<{ id: string; label: string }>;

export type RankingFixture = Readonly<{
	label: string;
	query: string;
	documents: readonly FixtureDocument[];
	rankers: readonly RankerName[];
	rankings: Readonly<Record<RankerName, readonly string[]>>;
	weights: Readonly<Record<RankerName, number>>;
	k: number;
}>;

export const illustrativeHomeEnergyFixture: RankingFixture = {
	label: "Illustrative home-energy retrieval fixture (synthetic)",
	query: "how do I inspect a residential rooftop solar installation?",
	documents: [
		{ id: "A", label: "Residential solar-installation guide (text with diagrams)" },
		{ id: "B", label: "Solar-tax-credit FAQ (text)" },
		{ id: "C", label: "Municipal solar-permit checklist (text)" },
		{ id: "D", label: "Rooftop-panel inspection photo guide (image and caption)" },
		{ id: "E", label: "Home-energy retrofit report (PDF)" },
		{ id: "F", label: "Inverter wiring diagram (image and text)" },
		{ id: "G", label: "Solar-roof stock image (image)" },
	],
	rankers: ["lexical", "text embedding", "multimodal embedding"],
	rankings: {
		lexical: ["B", "C", "D", "A", "E"],
		"text embedding": ["D", "C", "F", "A", "E"],
		"multimodal embedding": ["F", "D", "G", "A", "E"],
	},
	weights: { lexical: 0.45, "text embedding": 0.3, "multimodal embedding": 0.25 },
	k: 60,
};
