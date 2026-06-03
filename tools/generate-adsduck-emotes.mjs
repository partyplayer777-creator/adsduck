import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const bridge = "C:\\Users\\User\\.codex\\tools\\codex-image-mcp\\server.mjs";
const reference = path.resolve(root, "src/assets/adsduck-logo-cropped.png");
const outDir = path.resolve(root, "src/assets/emotes");

const sharedPrompt = [
  "Use case: stylized-concept",
  "Asset type: transparent app sticker/emoticon",
  "Input image: the AdsDuck logo is the character reference.",
  "Subject: a cute mascot duck based on the reference character, keeping the black sideways cap, black sunglasses, gold duck bill, gold chain, confident streetwear personality, and clean black-white-gold brand feel.",
  "Style/medium: polished 3D sticker illustration, rounded friendly forms, expressive pose, clean edges, high contrast, app-emoticon quality.",
  "Composition/framing: single full-body or upper-body duck mascot centered with generous padding.",
  "Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for removal.",
  "Constraints: no wordmark, no letters, no Korean text, no English text, no watermark, no border, no speech bubble text.",
  "Background rules: one uniform #00ff00 only, no shadows, no gradients, no texture, no floor plane, no reflections. Do not use #00ff00 anywhere in the subject.",
].join("\n");

const jobs = [
  {
    file: "adsduck-emote-cheer.png",
    prompt: `${sharedPrompt}\nPrimary request: cheering pose with both wings up, energetic contest celebration, joyful open-mouth smile.`,
  },
  {
    file: "adsduck-emote-thinking.png",
    prompt: `${sharedPrompt}\nPrimary request: thinking pose, one wing touching the chin, sunglasses slightly lowered, curious and clever mood.`,
  },
  {
    file: "adsduck-emote-winner.png",
    prompt: `${sharedPrompt}\nPrimary request: winner pose holding a shiny gold trophy, proud but cute, prize-award celebration mood.`,
  },
  {
    file: "adsduck-emote-surprised.png",
    prompt: `${sharedPrompt}\nPrimary request: surprised reaction pose, sunglasses tilted, wings lifted, round shocked expression, no text or symbols.`,
  },
  {
    file: "adsduck-emote-sorry.png",
    prompt: `${sharedPrompt}\nPrimary request: polite apologizing pose, slight bow, small shy smile, humble and friendly mood.`,
  },
  {
    file: "adsduck-emote-ready.png",
    prompt: `${sharedPrompt}\nPrimary request: ready-to-work pose holding a small blank checklist clipboard with simple check marks only, confident helpful mood.`,
  },
];

for (const job of jobs) {
  const out = path.join(outDir, job.file);
  const args = [
    bridge,
    "--generate",
    "--prompt",
    job.prompt,
    "--size",
    "1024x1024",
    "--quality",
    "high",
    "--output-format",
    "png",
    "--background",
    "opaque",
    "--remove-background",
    "--auto-key",
    "border",
    "--reference-image",
    reference,
    "--out",
    out,
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const jsonStart = result.stdout.indexOf("{");
  const response = jsonStart >= 0 ? JSON.parse(result.stdout.slice(jsonStart)) : null;
  const saved = response?.saved?.[0];
  if (
    response?.request?.size !== "1024x1024" ||
    response?.request?.reference_images !== 1 ||
    !saved?.matches_requested_size ||
    !saved?.background_removed ||
    path.resolve(saved.path) !== out
  ) {
    throw new Error(`Invalid bridge output for ${job.file}`);
  }
}
