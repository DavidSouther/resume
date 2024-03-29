import {
  FileSystem,
  ObjectFileSystemAdapter,
} from "@davidsouther/jiffies/lib/esm/fs";
import { loadContent } from "./content";

test("it loads content", async () => {
  const content = await loadContent(
    new FileSystem(
      new ObjectFileSystemAdapter({
        "/01_start.md": "The quick brown",
        "/20b/40_part.md": "fox jumped",
        "/20b/56_part_d.md": "over the lazy",
        "/_tweedle_dum.md": "Tweedle Dee",
        "/54_a/12_section.md": "dog.",
      })
    )
  );

  expect(content.length).toBe(4);
});
