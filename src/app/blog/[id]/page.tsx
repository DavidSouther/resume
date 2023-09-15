import { getPost, getPostPaths } from "~/lib/posts";
import BlogPage from "./blog-page";

export async function generateStaticParams() {
  return (await getPostPaths()).map((id) => ({ id }));
}

export default async function Page({
  params: { id },
}: {
  params: { id: string };
}) {
  const post = await getPost(id);
  return <BlogPage post={post} />;
}
