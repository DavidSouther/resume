import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import stylesheetUrl from "./styles/index.css";

export function headers() {
  return {
    "Cache-Control": "public, s-maxage=360",
  };
}

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/@picocss/pico@latest/css/pico.min.css",
    },
    {
      rel: "stylesheet",
      href: stylesheetUrl,
    },
  ];
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="container">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
