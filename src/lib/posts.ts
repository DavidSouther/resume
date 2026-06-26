import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { toHTML as jiffdown } from "@davidsouther/jiffdown";
import matter from "gray-matter";

export interface Post {
	id: string;
	show: boolean;
	date?: string;
	summary?: string;
	title?: string;
	body?: string;
	image?: string;
}

interface PostSource {
	id: string;
	path: string;
}

function getPostSources(): PostSource[] {
	const postsDir = join(cwd(), "posts");
	const sources = readdirSync(postsDir, { withFileTypes: true }).flatMap(
		(entry): PostSource[] => {
			if (entry.isFile() && entry.name.endsWith(".md")) {
				return [
					{
						id: entry.name.replace(/\.md$/, ""),
						path: join(postsDir, entry.name),
					},
				];
			}

			if (entry.isDirectory()) {
				const path = join(postsDir, entry.name, "post.md");
				if (existsSync(path)) {
					return [{ id: entry.name, path }];
				}
			}

			return [];
		},
	);

	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const { id } of sources) {
		if (seen.has(id)) {
			duplicates.add(id);
		}
		seen.add(id);
	}
	if (duplicates.size > 0) {
		throw new Error(
			`Duplicate post id${duplicates.size === 1 ? "" : "s"}: ${[...duplicates].join(", ")}`,
		);
	}

	return sources;
}

export function getPostPaths(): string[] {
	return getPostSources().map(({ id }) => id);
}

export function getSortedPosts(): Post[] {
	const posts = getPostSources()
		.map(({ id, path }) => {
			const post = readFileSync(path, "utf-8");
			const front = matter(post);
			const date =
				(front.data.date as Date | undefined)?.toISOString() ?? undefined;
			const show = Boolean(front.data.show ?? true);
			return {
				id,
				date,
				show,
				summary: front.data.summary as string | undefined,
				title: front.data.title as string | undefined,
				image: front.data.image as string | undefined,
			};
		})
		.filter(({ show }) => show);

	posts.sort(({ date: dateA = "2999" }, { date: dateB = "2999" }) =>
		dateA.localeCompare(dateB),
	);
	posts.reverse();
	return posts;
}

export async function getPost(id: string): Promise<Post> {
	const source = getPostSources().find((postSource) => postSource.id === id);
	if (!source) {
		throw new Error(`Post not found: ${id}`);
	}

	const postText = readFileSync(source.path, "utf-8");
	const front = matter(postText);
	const date =
		(front.data.date as Date | undefined)?.toISOString() ?? undefined;
	const title = front.data.title ?? "Unknown Title";
	const image = front.data.image;
	const contentHtml = jiffdown(front.content);
	const post = {
		id,
		date,
		title,
		body: contentHtml,
		show: true,
		...(image ? { image } : {}),
	};
	return post;
}
