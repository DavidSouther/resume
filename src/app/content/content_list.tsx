import { Content } from "~/lib/content";

export default function ContentList({ contents }: { contents: Content[] }) {
  return (
    <>
      {contents.map((c) => (
        <details key={`${c.path}/${c.id}`}>
          <summary>
            {c.id} ({c.path.replace(process.cwd(), "")})
          </summary>
          <ContentDetail content={c} />
        </details>
      ))}
    </>
  );
}

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
