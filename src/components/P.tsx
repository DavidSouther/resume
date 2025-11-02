"use client";
import { toHTML } from "@davidsouther/jiffdown";
import { useMemo } from "react";

export const MD = ({ children }: { children: string }) => {
  const body = useMemo(() => toHTML(children), [children]);
  return <div dangerouslySetInnerHTML={{ __html: body ?? "" }}></div>;
};

export const A = ({ href, children }: { children: string; href?: string }) =>
  href ? <a href={href}>{children}</a> : <span>{children}</span>;
