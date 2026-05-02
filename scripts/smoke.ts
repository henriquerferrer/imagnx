// Manual real-API verification before releases. Costs cents.
// Run via `npm run smoke` (uses tsx).
import { createOpenAIProvider } from "../src/providers/openai.js";
import { createGeminiProvider } from "../src/providers/gemini.js";

async function smoke() {
  const out: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    const p = createOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    const r = await p.generate("gpt-image-1.5", {
      prompt: "a single red dot",
      size: "1024x1024",
      quality: "low",
    });
    out.push(`openai: ${r.length} image(s), ${r[0]!.bytes.length} bytes`);
  } else {
    out.push("openai: SKIPPED (OPENAI_API_KEY not set)");
  }

  const gKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (gKey) {
    const p = createGeminiProvider({ apiKey: gKey });
    const r = await p.generate("gemini-2.5-flash-image", { prompt: "a single red dot" });
    out.push(`google: ${r.length} image(s), ${r[0]!.bytes.length} bytes`);
  } else {
    out.push("google: SKIPPED (GEMINI_API_KEY not set)");
  }

  for (const line of out) console.log(line);
}

smoke().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
