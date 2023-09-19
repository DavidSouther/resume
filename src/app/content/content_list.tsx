import { Content } from "~/lib/content";

export default function ContentList({ contents }: { contents: Content[] }) {
  return (
    <>
      {contents.map((c) => (
        <details key={`${c.path}/${c.id}`}>
          <summary>{c.path.replace(process.cwd(), "")}</summary>
          <ContentDetail content={c} />
        </details>
      ))}
    </>
  );
}

function ContentDetail({ content }: { content: Content }) {
  const messages = content.messages ?? [];
  const [system, conversation] =
    messages.length > 0 && messages[0]?.role === "system"
      ? [messages[0], messages.slice(1)]
      : [undefined, messages];
  return (
    <dl>
      <dt>Messages</dt>
      <dd>{messages.length}</dd>
      {system && (
        <>
          <dt>System</dt>
          <dd>{system.content}</dd>
        </>
      )}
      <dt>Messages</dt>
      {conversation.map((m, i) => (
        <>
          <dd key={i}>
            <b>{m.role}:</b> {m.content}
          </dd>
        </>
      ))}
      <dt>Tokens</dt>
      <dd>{content.tokens ?? "Unknown"}</dd>
    </dl>
  );
}
