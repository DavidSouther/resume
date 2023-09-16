import { FileSystem, Stats } from "@davidsouther/jiffies/lib/esm/fs";
import matter from "gray-matter";
import { join, normalize } from "path/posix";

// Content is ordered on the file system using NN_id folders and nnp_id.md files.
// The Content needs to keep track of where in the file system it is, so that a Prompt can write a Response.
// It also needs the predecessor Content at the same level of the file system to build the larger context of its message pairs.
export interface Content {
  path: string;
  system: string[];
  order: number;
  type: "system" | "prompt" | "response";
  id: string;
  predecessor?: Content;
  content: string;
  head?: unknown;
}

const MISSING: Stats = {
  isDirectory: () => false,
  isFile: () => false,
  name: "MISSING",
};

interface PartitionedDirectory {
  files: Stats[];
  folders: Stats[];
}

function defaultPartitionedDirectory(): PartitionedDirectory {
  return {
    files: [],
    folders: [],
  };
}

function partitionDirectory(stats: Stats[]): PartitionedDirectory {
  return stats.reduce((dir, stats) => {
    if (stats.isDirectory()) dir.folders.push(stats);
    if (stats.isFile()) dir.files.push(stats);
    return dir;
  }, defaultPartitionedDirectory());
}

async function loadDir(fs: FileSystem): Promise<PartitionedDirectory> {
  let dir = await fs.readdir(normalize(join(fs.cwd(), ".")));
  let entries = await Promise.all(dir.map((s) => fs.stat(s)));
  return partitionDirectory(entries);
}

export type Ordering =
  | { order: number; id: string; type: "prompt" | "response" }
  | { id: string; type: "system" }
  | { type: "ignore" };

function splitOrderedName(name: string): Ordering {
  if (name.startsWith("_s")) {
    return { type: "system", id: name.substring(2) };
  }
  if (name.startsWith("_")) {
    return { type: "ignore" };
  }
  const parts = name.match(/(\d+)([pr])_(.+)/);
  if (parts) {
    return {
      type: parts[2] === "p" ? "prompt" : "response",
      order: Number(parts[1]),
      id: parts[3],
    };
  }

  return { type: "ignore" };
}

async function loadFile(
  fs: FileSystem,
  file: Stats,
  system: string[]
): Promise<Content | undefined> {
  const ordering = splitOrderedName(file.name);
  if (ordering.type == "prompt" || ordering.type == "response") {
    const { content, data } = matter(
      await fs.readFile(file.name).catch((e) => "")
    );
    return {
      ...ordering,
      system,
      path: join(fs.cwd(), file.name),
      content,
      head: data,
    };
  } else {
    return undefined;
  }
}

export async function loadContent(
  fs: FileSystem,
  system: string[] = []
): Promise<Content[]> {
  const sys = await fs.readFile("_s").catch((e) => "");
  const dir = await loadDir(fs).catch((e) => defaultPartitionedDirectory());
  const files: Content[] = (
    await Promise.all(dir.files.map((file) => loadFile(fs, file, system)))
  ).filter((c): c is Content => c !== undefined);
  files.sort((a, b) => b.order - a.order);
  for (let i = files.length - 1; i > 0; i--) {
    files[i].predecessor = files[i - 1];
  }

  const folders: Content[] = [];
  for (const folder of dir.folders) {
    fs.pushd(folder.name);
    let contents = await loadContent(fs, [...system, sys]);
    folders.push(...contents);
    fs.popd();
  }

  return [...files, ...folders];
}
