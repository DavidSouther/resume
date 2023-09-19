"use client";
import { useState } from "react";
import { generateAllAction } from "./generate";
import { Summary } from "~/lib/content";

export default function GenerateAll({ summary }: { summary: Summary }) {
  const [status, setStatus] = useState<string>("Not yet run");

  async function generateAll() {
    debugger;
    console.log("Action");
    let { message } = await generateAllAction();
    setStatus(message);
  }

  return (
    <>
      <ContentSummary summary={summary} />
      <button onClick={generateAll}>Generate All</button>
      {status}
    </>
  );
}

const OUT_COST = 0.016;
const IN_COST = 0.012;

export function ContentSummary({ summary }: { summary: Summary }) {
  const [outLength, setOutLength] = useState(125);
  const cost = Number(
    (outLength * OUT_COST + summary.tokens * IN_COST) / 1000
  ).toFixed(6);
  return (
    <p>
      This generation set has {summary.tokens} total tokens in {summary.prompts}{" "}
      conversations. Using an output size of{" "}
      <input
        className="inline"
        style={{ width: "inherit" }}
        type="number"
        defaultValue={outLength}
        onChange={(e) => setOutLength(Number(e.target.value))}
      />
      tokens, this generation should cost ${cost}.
    </p>
  );
}
