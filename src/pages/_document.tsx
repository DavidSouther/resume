import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="white"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="black"
        />
        <style>
          {`
@media print {
  p, li {
    --font-size: 10pt;
  }

  body {
      font-size: 10pt;
  }
  .container {
      max-width: 100vw;
  }
  .projects, .publications {
      width: 50vw;
  }
  .projects { float: left;}
  .publications {float: right;}
  footer { clear: both; }
}`}
        </style>
      </Head>
      <body className="container">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
