import { describe, expect, it } from "vitest";
import { getPost, getPostPaths } from "~/lib/posts";
import Page, { generateMetadata, generateStaticParams } from "./page";

// Integration-style: these exercise the real committed posts/ fixtures. The
// first id from getPostPaths() stands in for "a known post" without hardcoding.
const id = getPostPaths()[0];

describe("generateStaticParams", () => {
	it("returns one { id } param per post path", async () => {
		const params = await generateStaticParams();

		expect(params).toEqual(getPostPaths().map((id) => ({ id })));
	});
});

describe("generateMetadata", () => {
	it("titles the page with the post title and a name suffix", async () => {
		const { title } = await getPost(id);

		const metadata = await generateMetadata({
			params: Promise.resolve({ id }),
		});

		expect(metadata.title).toBe(`${title} - David Souther`);
	});

	it("sets the canonical metadataBase", async () => {
		const metadata = await generateMetadata({
			params: Promise.resolve({ id }),
		});

		expect(String(metadata.metadataBase)).toBe("https://davidsouther.com/");
	});

	it("lists the post image in openGraph, or none when absent", async () => {
		const { image } = await getPost(id);

		const metadata = await generateMetadata({
			params: Promise.resolve({ id }),
		});

		expect(metadata.openGraph?.images).toEqual(image ? [image] : []);
	});
});

describe("Page", () => {
	it("loads the requested post and passes it to the body", async () => {
		const post = await getPost(id);

		const element = await Page({ params: Promise.resolve({ id }) });

		expect(element.props.post.id).toBe(id);
		expect(element.props.post.title).toBe(post.title);
	});
});
