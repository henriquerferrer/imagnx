# imgen

Multi-model image generation CLI. Supports OpenAI (`gpt-image-1.5`, `gpt-image-2`) and Google (`gemini-2.5-flash-image` aka Nano Banana).

## Install

~~~~bash
bun install -g github.com/<user>/imgen
~~~~

## Quick start

~~~~bash
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
imgen "a cat astronaut on the moon"
imgen "a cat astronaut on the moon" --compare       # all configured providers
imgen edit photo.png "give the cat a red helmet"
~~~~

## Skill (Claude Code)

~~~~bash
npx skills add github.com/<user>/imgen/skill
~~~~

See `docs/superpowers/specs/2026-05-01-imgen-cli-design.md` for the design.
