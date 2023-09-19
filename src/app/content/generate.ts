"use server";

import { dirname, join } from "path";
import { Content, addMessagesToContent, loadContent } from "~/lib/content";
import { NodeFileSystem } from "~/lib/fs";

export async function generateAllAction() {
  await generateAll();
  return { message: "Generating" };
}

// TODO make this async*
export async function generateAll() {
  const fs = new NodeFileSystem();
  fs.cd("content");
  const content = await loadContent(fs);
  const summary = await addMessagesToContent(content);

  await Promise.all(
    content.map(async (c) => {
      const generated = await generateOne(c);
      const path = join(dirname(c.path), `${c.order}r_${c.id}`);
      await fs.writeFile(
        path,
        `---\ngenerated: ${new Date().toISOString()}\ndebug: ${JSON.stringify(
          generated.debug
        )}\n---\n\n${generated.message}`
      );
    })
  );
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateOpenAi(
  c: Content
): Promise<{ message: string; debug: unknown }> {
  console.log("Calling OpenAI", c.messages ?? []);
  const completions = await openai.chat.completions.create({
    messages: (c.messages ?? []).map(({ role, content }) => ({
      role,
      content,
    })),
    model: "gpt-3.5-turbo",
  });
  console.log("Response from OpenAI", completions);
  const choice = completions.choices[0];
  return {
    message: choice.message.content ?? "",
    debug: {
      id: completions.id,
      model: completions.model,
      usage: completions.usage,
      finish: choice.finish_reason,
    },
  };
}

async function generateOne(
  c: Content
): Promise<{ message: string; debug: unknown }> {
  return generateOpenAi(c);
}
