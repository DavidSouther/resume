"use client";

import { GoogleAnalytics } from "nextjs-google-analytics";
const GA_ID = "G-6X1Z1L95D8";

export default function Analytics() {
  return <GoogleAnalytics trackPageViews gaMeasurementId={GA_ID} />;
}
