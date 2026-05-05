// Style preset library. Ported (with adaptations) from SnapAI's
// src/utils/styleTemplates.ts. Copyright (c) Beto Moedano, MIT licensed.
// Full upstream license at LICENSES/SnapAI-MIT.txt.
// Source: https://github.com/betomoedano/snapai/blob/main/src/utils/styleTemplates.ts
import { InvalidArgs } from "../errors.js";

export type StyleId =
  | "minimalism" | "glassy" | "woven" | "geometric" | "neon" | "gradient"
  | "flat" | "material" | "ios-classic" | "android-material" | "pixel"
  | "game" | "clay" | "holographic" | "kawaii" | "cute";

export type StyleCommand = "generate" | "icon" | "edit";

export interface StyleDefinition {
  readonly id: StyleId;
  readonly summary: string;
  readonly appliesTo: ReadonlyArray<StyleCommand>;
  readonly culturalDna?: ReadonlyArray<string>;
  readonly description?: string;
  readonly visualTraits?: ReadonlyArray<string>;
  readonly mandatory?: ReadonlyArray<string>;
  readonly forbidden?: ReadonlyArray<string>;
  readonly avoid?: ReadonlyArray<string>;
  readonly checklist?: ReadonlyArray<string>;
  readonly includeBaseRules?: boolean;
}

// Universal presets work everywhere; the rest are icon-only.
const UNIVERSAL: ReadonlySet<StyleId> = new Set([
  "minimalism", "flat", "pixel", "kawaii", "neon", "holographic", "material",
]);

function appliesToFor(id: StyleId): ReadonlyArray<StyleCommand> {
  return UNIVERSAL.has(id) ? ["generate", "icon", "edit"] : ["icon"];
}

export const STYLE_DEFINITIONS: Record<StyleId, StyleDefinition> = {
  minimalism: {
    id: "minimalism",
    appliesTo: appliesToFor("minimalism"),
    summary:
      "Extreme reduction for clarity and function (Swiss/Braun/Apple). One dominant symbol, max 3 colors, must work in monochrome and remain readable at tiny sizes. No gradients, shadows, textures, or 3D.",
    culturalDna: ["Swiss design", "Apple", "Braun", "Dieter Rams", "Functionalism"],
    description: "Extreme reduction focused on clarity and function.",
    visualTraits: [
      "max 3 colors",
      "simple primary silhouettes",
      "large negative space",
      "textures: false",
      "effects: false",
    ],
    mandatory: [
      "Must be readable at very small sizes",
      "Must work in monochrome",
      "Single dominant symbol",
    ],
    forbidden: ["Gradients", "Shadows", "3D effects", "Decorative details", "Textures"],
    avoid: ["Over-design", "Complex metaphors", "Visual noise"],
    checklist: [
      "Can it be drawn in under 5 strokes?",
      "Is it clear without color?",
      "Is it recognizable at 24px?",
    ],
    includeBaseRules: true,
  },

  glassy: {
    id: "glassy",
    appliesTo: appliesToFor("glassy"),
    summary:
      "Glassmorphism (iOS 15+/VisionOS): translucent, layered, rounded glass that subtly blurs and reflects the background. Must feel like it floats while staying legible through contrast. Avoid harsh shadows or flat opacity.",
    culturalDna: ["iOS 15+", "VisionOS", "Glassmorphism", "Futuristic premium UI"],
    description: "Translucent, layered, glass-like appearance.",
    visualTraits: [
      "transparency: true",
      "blur: soft background blur",
      "edges: rounded",
      "layers: floating",
    ],
    mandatory: [
      "Blur must be subtle",
      "Icon must interact with background",
      "Maintain legibility through contrast",
    ],
    forbidden: ["Flat opacity without blur", "Harsh shadows", "No reflections"],
    avoid: ["Over-blurring", "Heavy solid colors", "Flat-only design"],
    checklist: [
      "Does it feel like glass?",
      "Does it float above the background?",
      "Is the blur controlled?",
    ],
    includeBaseRules: true,
  },

  woven: {
    id: "woven",
    appliesTo: appliesToFor("woven"),
    summary:
      "Handmade textile craft: braided/woven rhythm with tactile fabric texture and warm organic imperfections. Must feel handcrafted (not sterile vector-perfect). Avoid perfect geometry, hard symmetry, and hard shadows.",
    culturalDna: ["Textile craft", "Handmade culture", "Organic design", "Artisan aesthetics"],
    description: "Interlaced, tactile, handcrafted visual language.",
    visualTraits: [
      "patterns: woven or braided",
      "lines: organic and imperfect",
      "texture: fabric-like",
      "symmetry: loose or imperfect",
    ],
    mandatory: ["Must feel handmade", "Visible weaving rhythm", "Tactile appearance"],
    forbidden: ["Perfect geometry", "Hard symmetry", "Ultra-clean digital look"],
    avoid: ["Sterile vector perfection", "Hard shadows"],
    checklist: ["Does it feel woven?", "Is there rhythm?", "Does it feel warm?"],
    includeBaseRules: true,
  },

  geometric: {
    id: "geometric",
    appliesTo: appliesToFor("geometric"),
    summary:
      "Bauhaus/system geometry: strict grid, measurable shapes (circles/squares/triangles), exact symmetry, mathematical curves only. Clean and logical—no organic curves, textures, or hand-drawn irregularities.",
    culturalDna: ["Bauhaus", "Mathematics", "System design", "Architectural logic"],
    description: "Strict geometry governed by grids and proportions.",
    visualTraits: [
      "shapes: circles, squares, triangles",
      "alignment: grid-based",
      "symmetry: exact",
      "curves: mathematical only",
    ],
    mandatory: [
      "All elements must follow a grid",
      "Everything must be measurable",
      "Consistent geometry",
    ],
    forbidden: ["Organic curves", "Textures", "Hand-drawn irregularities"],
    avoid: ["Emotional asymmetry", "Decorative randomness"],
    checklist: [
      "Can every element be measured?",
      "Is symmetry intentional?",
      "Does it feel logical?",
    ],
    includeBaseRules: true,
  },

  neon: {
    id: "neon",
    appliesTo: appliesToFor("neon"),
    summary:
      "Cyberpunk nightlife glow: high saturation, extreme contrast, dark background assumed. Glow is mandatory and must feel electric. Avoid muted colors, white backgrounds, weak glow, or unfocused light sources.",
    culturalDna: ["Cyberpunk", "Nightlife", "Gaming", "Electronic culture"],
    description: "High-energy glowing visuals designed for dark environments.",
    visualTraits: [
      "colors: high saturation",
      "glow: strong and visible",
      "background: dark",
      "contrast: extreme",
    ],
    mandatory: ["Glow is required", "Dark background assumed", "High contrast"],
    forbidden: ["Muted colors", "White background", "Weak glow"],
    avoid: ["Too many colors", "Unfocused light sources"],
    checklist: ["Does it glow?", "Does it feel electric?", "Does it work at night?"],
    includeBaseRules: true,
  },

  gradient: {
    id: "gradient",
    appliesTo: appliesToFor("gradient"),
    summary:
      "Modern social-app gradients: smooth clean color flow (max 4 colors) with intentional direction. No banding, no dirty gradients, and no textures fighting the gradient. Gradients are a primary design element.",
    culturalDna: ["Modern social apps", "Instagram-era UI", "Emotional color flow"],
    description: "Smooth color transitions used as a primary design element.",
    visualTraits: ["max 4 colors", "smooth transitions", "intentional direction/flow"],
    mandatory: ["Clean gradient transitions", "Clear gradient direction", "No banding"],
    forbidden: ["Dirty gradients", "Too many colors", "Textures over gradients"],
    avoid: ["Flat + gradient conflicts"],
    checklist: ["Does the color flow?", "Is direction clear?", "Is it clean?"],
    includeBaseRules: true,
  },

  flat: {
    id: "flat",
    appliesTo: appliesToFor("flat"),
    summary:
      "Pure flat corporate clarity (Microsoft-style): solid colors, zero depth, zero shadows, zero gradients, no effects. Instant readability and clean contrast.",
    culturalDna: ["Microsoft design", "Corporate clarity", "Information-first UI"],
    description: "Purely flat, functional, neutral icons.",
    visualTraits: ["depth: none", "colors: solid", "effects: false"],
    mandatory: ["No depth", "No shadows", "Clear contrast"],
    forbidden: ["Gradients", "Shadows", "3D effects"],
    checklist: ["Is everything flat?", "Is it instantly clear?"],
    includeBaseRules: true,
  },

  material: {
    id: "material",
    appliesTo: appliesToFor("material"),
    summary:
      "Material Design layering: subtle depth with soft directional shadows and consistent elevation. Clear hierarchy, physical-digital metaphor. Avoid harsh shadows and extreme realism.",
    culturalDna: ["Google Material Design", "Physical-digital metaphor"],
    description: "Layered design simulating physical materials.",
    visualTraits: ["layers: true", "shadows: soft and directional", "depth: subtle"],
    mandatory: ["Consistent elevation", "Clear hierarchy", "Soft shadows"],
    forbidden: ["Harsh shadows", "Extreme realism"],
    includeBaseRules: true,
  },

  "ios-classic": {
    id: "ios-classic",
    appliesTo: appliesToFor("ios-classic"),
    summary:
      "Pre‑iOS7 skeuomorphism: high detail, realistic materials, and explicit lighting to mimic physical objects. Avoid flat design and extreme minimalism.",
    culturalDna: ["Pre‑iOS7 Apple", "Skeuomorphism"],
    description: "Highly detailed, realistic icons mimicking physical objects.",
    visualTraits: ["detail: high", "materials: realistic", "lighting: explicit"],
    forbidden: ["Flat design", "Extreme minimalism"],
    includeBaseRules: false,
  },

  "android-material": {
    id: "android-material",
    appliesTo: appliesToFor("android-material"),
    summary:
      "Android Material 3 vibe: modern shapes, dynamic color, gentle depth cues, clean readability. Avoid photoreal textures and messy realism.",
    culturalDna: ["Android Material 3"],
    description: "Material 3-inspired icons with modern geometry and gentle depth cues.",
    visualTraits: ["clean geometry", "dynamic color", "subtle depth cues", "readable hierarchy"],
    mandatory: ["Clear hierarchy", "Gentle depth cues", "Clean shapes"],
    forbidden: ["Photoreal textures", "Messy realism", "Harsh shadows"],
    includeBaseRules: true,
  },

  pixel: {
    id: "pixel",
    appliesTo: appliesToFor("pixel"),
    summary:
      "8‑bit pixel grid icons: strict pixel alignment, low-resolution look, hard edges, no blur, no anti‑aliasing, no gradients. Retro clarity at small sizes.",
    culturalDna: ["8-bit gaming", "Retro computing"],
    description: "Icons built on strict pixel grids.",
    visualTraits: ["grid: pixel-based", "edges: hard", "resolution: low"],
    mandatory: ["Pixel grid alignment", "No blur", "No anti-aliasing"],
    forbidden: ["Smooth curves", "Gradients", "Soft edges"],
    includeBaseRules: false,
  },

  game: {
    id: "game",
    appliesTo: appliesToFor("game"),
    summary:
      "Game UI icons: expressive, high-impact, fantasy/action energy with strong silhouette and high contrast. Avoid corporate neutrality and over-minimalism.",
    culturalDna: ["Video game UI", "Fantasy and exaggeration"],
    description: "Expressive, high-impact icons designed for gameplay interfaces.",
    visualTraits: ["contrast: high", "style: expressive", "theme: fantasy or action"],
    forbidden: ["Corporate neutrality", "Over-minimalism"],
    includeBaseRules: true,
  },

  clay: {
    id: "clay",
    appliesTo: appliesToFor("clay"),
    summary:
      "Claymorphism: soft rounded volumetric forms, pastel palette, diffuse shadows, friendly warmth. Avoid hard edges and aggressive colors.",
    culturalDna: ["Claymorphism", "Friendly UI"],
    description: "Soft, rounded, clay-like volumetric icons.",
    visualTraits: ["volume: soft", "colors: pastel", "shadows: diffuse"],
    forbidden: ["Hard edges", "Aggressive colors"],
    includeBaseRules: true,
  },

  holographic: {
    id: "holographic",
    appliesTo: appliesToFor("holographic"),
    summary:
      "Iridescent hologram visuals: visible color-shift and dynamic light interaction on an iridescent material. Avoid flat color with no light response.",
    culturalDna: ["Sci-fi", "Futurism", "Iridescent materials"],
    description: "Light-reactive, color-shifting hologram visuals.",
    visualTraits: ["color_shift: true", "lighting: dynamic", "material: iridescent"],
    forbidden: ["Flat color", "No light interaction"],
    includeBaseRules: true,
  },

  kawaii: {
    id: "kawaii",
    appliesTo: appliesToFor("kawaii"),
    summary:
      "Japanese kawaii (Sanrio/pop culture): extreme chibi cuteness—big head/tiny body, very large sparkling eyes, blush cheeks, thick clean outlines, pastel palette, and cozy “toy-like” simplicity. Strongly character-led. Avoid realism and dark/aggressive vibes.",
    culturalDna: ["Japanese pop culture", "Sanrio", "Cute emotional design"],
    description: "Exaggerated cuteness designed to evoke affection.",
    visualTraits: [
      "faces: very simple + highly expressive (big round eyes, tiny mouth, optional blush)",
      "proportions: chibi (big head, tiny body), rounded silhouettes",
      "outlines: thick, clean, consistent",
      "colors: soft pastel palette (high-key), minimal shading",
      "details: minimal; a few cute accents are OK (small stars/hearts)",
    ],
    mandatory: [
      "Must evoke cuteness immediately",
      "Friendly expression is required",
      "Rounded shapes; no sharp angles",
      "Prefer character-led/chibi interpretation when appropriate",
    ],
    forbidden: ["Sharp angles", "Dark aggressive themes", "Realism", "Serious/neutral emotion"],
    avoid: ["Complex detail", "Gritty texture", "Overly mature/corporate look"],
    checklist: ["Is it adorable?", "Does it feel friendly?", "Would a child smile?"],
    includeBaseRules: true,
  },

  cute: {
    id: "cute",
    appliesTo: appliesToFor("cute"),
    summary:
      "Cute (general): friendly, sweet, approachable design—rounded shapes, warm colors, simple charming details. Less “chibi” and less character-centric than kawaii; more modern brand-friendly illustration. Avoid harsh geometry and dark oppressive palettes.",
    culturalDna: ["Playful UI", "Friendly branding", "Emotional warmth"],
    description: "Soft, approachable and emotionally positive design.",
    visualTraits: [
      "shapes: rounded, clean, modern",
      "colors: bright or pastel, but not strictly \"kawaii pastel\"",
      "details: simple and charming; minimal background decorations",
      "faces: optional and subtle (avoid huge anime eyes by default)",
      "rendering: clean illustration / gentle shading (not glossy/glassy)",
    ],
    mandatory: [
      "Friendly tone",
      "Soft shapes",
      "Positive emotion",
      "Prefer object-icon or hybrid-icon; add a face only if it truly helps the concept",
    ],
    forbidden: ["Harsh geometry", "Dark oppressive palettes", "Cold minimalism"],
    avoid: ["Over-detailing", "Aggressive contrast", "Extreme chibi proportions", "Too many sparkles/decals"],
    checklist: ["Is it approachable?", "Does it feel warm?", "Is it playful?"],
    includeBaseRules: true,
  },
};

export function getAvailableStyles(forCommand?: StyleCommand): StyleId[] {
  const all = Object.keys(STYLE_DEFINITIONS) as StyleId[];
  if (!forCommand) return all;
  return all.filter((id) => STYLE_DEFINITIONS[id].appliesTo.includes(forCommand));
}

function formatList(items?: ReadonlyArray<string>): string | null {
  if (!items || items.length === 0) return null;
  return items.join(", ");
}

function formatPromptSection(label: string, items?: ReadonlyArray<string>): string | null {
  const text = formatList(items);
  if (!text) return null;
  return `${label}: ${text}.`;
}

// Derive the SnapAI-style systemName from the id ("ios-classic" → "IOS_CLASSIC").
function systemNameFor(id: StyleId): string {
  return id.replace(/-/g, "_").toUpperCase();
}

// Inline reinforcement block — meant to be embedded inside a larger prompt.
// Mirrors SnapAI's buildStyleBlock(def, "inline") in src/utils/styleTemplates.ts (MIT).
function buildStyleBlockInline(def: StyleDefinition): string {
  const parts: Array<string | null> = [
    `Style system: ${systemNameFor(def.id)}.`,
    def.culturalDna?.length ? `Cultural DNA: ${formatList(def.culturalDna)}.` : null,
    def.description ? `Description: ${def.description}` : null,
    def.visualTraits?.length ? `Visual traits: ${def.visualTraits.join("; ")}.` : null,
    formatPromptSection("Mandatory", def.mandatory),
    formatPromptSection("Forbidden", def.forbidden),
    formatPromptSection("Avoid", def.avoid),
    def.checklist?.length ? `Checklist: ${def.checklist.join(" ")}` : null,
  ];
  return parts.filter((p): p is string => Boolean(p)).join(" ");
}

export function getStyleDirective(id: StyleId): string {
  const def = STYLE_DEFINITIONS[id];
  if (!def) throw new InvalidArgs(`Unknown style "${id}"`);
  return buildStyleBlockInline(def);
}

export function getStyleDescription(id: StyleId): string {
  const def = STYLE_DEFINITIONS[id];
  if (!def) throw new InvalidArgs(`Unknown style "${id}"`);
  return def.summary;
}

export function validateStyleForCommand(name: string, command: StyleCommand): StyleId {
  const lower = name.trim().toLowerCase() as StyleId;
  const def = STYLE_DEFINITIONS[lower];
  if (!def) {
    throw new InvalidArgs(
      `unknown style '${name}'; valid: ${(Object.keys(STYLE_DEFINITIONS) as StyleId[]).join(", ")}`,
    );
  }
  if (!def.appliesTo.includes(command)) {
    throw new InvalidArgs(
      `'${lower}' only supported on: ${def.appliesTo.join(", ")}`,
    );
  }
  return lower;
}
