import { getSortedPosts } from "~/lib/posts";
import BlogList from "./blog-list";

export default async function Page() {
  const posts = await getSortedPosts();
  return <BlogList posts={posts} />;
}
