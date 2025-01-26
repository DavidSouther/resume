import { getPost, getPostPaths, Post } from "~/lib/posts";
import BlogPage from "./blog-page";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return (await getPostPaths()).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { title, image } = await getPost(id);
  const openGraph = {
    images: [...(image ? [image] : [])],
  };
  return {
    title: `${title} - David Souther`,
    metadataBase: new URL("https://davidsouther.com"),
    openGraph,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  return <BlogPage post={post} />;
}
