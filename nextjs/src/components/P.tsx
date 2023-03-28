import Markdown from "marked-react";

export const P = ({ children }: { children: string }) => (
  <Markdown>{children}</Markdown>
);
