import { Card } from "~/components/Card";
import ContentList from "./content_list";
import { NodeFileSystemAdapter } from "~/lib/fs";
import { FileSystem } from "@davidsouther/jiffies/lib/esm/fs";
import { join } from "path";
import { addMessagesToContent, loadContent } from "~/lib/content";
import GenerateAll from "./generate_all";

const adapter = new NodeFileSystemAdapter();
const fs = new FileSystem(adapter);
fs.cd(join(process.cwd(), "content"));

export default async function ContentPage() {
  const content = await loadContent(fs);
  const summary = await addMessagesToContent(content);
  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <Card header="Content list">
        <ContentList contents={content} />
      </Card>
      <Card header="Generation">
        <GenerateAll summary={summary} />
      </Card>
    </div>
  );
}
