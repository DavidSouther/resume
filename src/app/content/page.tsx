import { addMessagesToContent, loadContent } from "~/lib/content";
import { FileSystem } from "@davidsouther/jiffies/lib/esm/fs";
import { NodeFileSystemAdapter } from "~/lib/fs";
import { join } from "path";
import ContentList from "./content_list";
import { Card } from "~/components/Card";

const adapter = new NodeFileSystemAdapter();
const fs = new FileSystem(adapter);
fs.cd(join(process.cwd(), "content"));

export default async function ContentPage() {
  const content = await loadContent(fs);
  const summary = await addMessagesToContent(content);
  return (
    <Card>
      <ContentList contents={content} summary={summary} />
    </Card>
  );
}
