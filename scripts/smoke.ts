// Manual real-API verification before releases. Costs cents.
// Run via `npm run smoke` (uses tsx).
import { createOpenAIProvider } from "../src/providers/openai.js";
import { createGeminiProvider } from "../src/providers/gemini.js";

async function smoke() {
  const out: string[] = [];

  const oKey = process.env.IMAGNX_OPENAI_API_KEY;
  if (oKey) {
    const p = createOpenAIProvider({ apiKey: oKey });
    const r = await p.generate("gpt-image-1.5", {
      prompt: "a single red dot",
      size: "1024x1024",
      quality: "low",
    });
    out.push(`openai: ${r.length} image(s), ${r[0]!.bytes.length} bytes`);
  } else {
    out.push("openai: SKIPPED (IMAGNX_OPENAI_API_KEY not set)");
  }

  const gKey =
    process.env.IMAGNX_GEMINI_API_KEY ?? process.env.IMAGNX_GOOGLE_API_KEY;
  if (gKey) {
    const p = createGeminiProvider({ apiKey: gKey });
    const r = await p.generate("gemini-2.5-flash-image", { prompt: "a single red dot" });
    out.push(`google: ${r.length} image(s), ${r[0]!.bytes.length} bytes`);
  } else {
    out.push("google: SKIPPED (IMAGNX_GEMINI_API_KEY not set)");
  }

  for (const line of out) console.log(line);
}

smoke().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
