import "~/styles/globals.css";
import type { AppProps } from "next/app";
import { GoogleAnalytics } from "nextjs-google-analytics";

const GA_ID = "G-6X1Z1L95D8";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <GoogleAnalytics trackPageViews gaMeasurementId={GA_ID} />
      <Component {...pageProps} />
    </>
  );
}
