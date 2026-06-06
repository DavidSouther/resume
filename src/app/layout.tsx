import type { Metadata, Viewport } from "next";
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
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="stylesheet" href="/jiffies-css-v2-bundle.min.css" />
				{/* Pre-paint theme picker: sets data-theme before hydration so the brand color varies per load with no flash. */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(()=>{const themes=["rust","teal","indigo","nominal"];document.documentElement.dataset.theme=themes[Date.now()%themes.length];})();`,
					}}
				/>
			</head>
			<body>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
