import { Metadata, Viewport } from "next";
import Analytics from "./analytics";
import "./global.css";

export const metadata: Metadata = {
  title: "David Souther",
  description: "davidsouther.com - resume, blog, playground",
  authors: { name: "David Souther", url: "davidsouther.com" },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/jiffies-css-bundle.min.css" />
      </head>
      <body className="container">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
