import { readFileSync, readdirSync } from "fs";
import matter from "gray-matter";
import { join } from "path";
import { cwd } from "process";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

export interface Post {
  id: string;
  show: boolean;
  date?: string;
  summary?: string;
  title?: string;
  body?: string;
  image?: string;
}

export function getPostPaths(): string[] {
  const postsDir = join(cwd(), "posts");
  const paths = readdirSync(postsDir).map((filename) => {
    return filename.replace(/\.md$/, "");
  });
  return paths;
}

export function getSortedPosts(): Post[] {
  const postsDir = join(cwd(), "posts");
  const posts = readdirSync(postsDir)
    .map((filename) => {
      const id = filename.replace(/.md$/, "");
      const post = readFileSync(join(postsDir, filename), "utf-8");
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
    dateA.localeCompare(dateB)
  );
  return posts;
}

export async function getPost(id: string): Promise<Post> {
  const filename = join(cwd(), "posts", id);
  const postText = readFileSync(filename + ".md", "utf-8");
  const front = matter(postText);
  const date =
    (front.data.date as Date | undefined)?.toISOString() ?? undefined;
  const title = front.data.title ?? "Unknown Title";
  const image = front.data.image;
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(front.content);
  const contentHtml = processedContent.toString();
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
