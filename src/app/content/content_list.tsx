"use client";
import { useState } from "react";
import { Content, Summary } from "~/lib/content";

function ContentDetail({ content }: { content: Content }) {
  const messages = content.messages ?? [];
  const system =
    messages.length > 0 && messages[0]?.role === "system"
      ? messages[0].content
      : "";
  return (
    <dl>
      <dt>Messages</dt>
      <dd>{messages.length}</dd>
      <dt>System</dt>
      <dd>{system}</dd>
      <dt>Tokens</dt>
      <dd>{content.tokens?.length}</dd>
    </dl>
  );
}

export default function ContentList({
  contents,
  summary,
}: {
  contents: Content[];
  summary: Summary;
}) {
  return (
    <>
      {contents.map((c) => (
        <details key={`${c.path}/${c.id}`}>
          <summary>
            {c.id} ({c.path})
          </summary>
          <ContentDetail content={c} />
        </details>
      ))}
      <ContentSummary summary={summary} />
    </>
  );
}

const OUT_COST = 0.016;
const IN_COST = 0.012;

export function ContentSummary({ summary }: { summary: Summary }) {
  const [outLength, setOutLength] = useState(125);
  const cost = (outLength * OUT_COST + summary.tokens * IN_COST) / 1000;
  return (
    <p>
      This generation set has {summary.tokens} total tokens in{" "}
      {summary.conversations} conversations. Using an output size of{" "}
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
