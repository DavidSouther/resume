import type { MetadataRoute } from "next";
import { getSortedPosts } from "~/lib/posts";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getSortedPosts();
  return [
    {
      url: "https://davidsouther.com",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: "https://davidsouther.com/blog",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `https://davidsouther.com/blog/${post.id}`,
      lastModified: new Date(post.date ? Date.parse(post.date) : Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
