"use server";

import { generateAll } from "~/lib/content";

export async function generateAllAction() {
  await generateAll();
  return { message: "Generating" };
}
