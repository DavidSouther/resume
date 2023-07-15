import Markdown from "marked-react";

export const P = ({ children }: { children: string }) => (
  <Markdown>{children}</Markdown>
);

export const A = ({ href, children }: { children: string; href?: string }) =>
  href ? (
    <>
      <a href={href}>{children}</a>
    </>
  ) : (
    <span>{children}</span>
  );
