import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function durationOf(file) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`ffprobe failed for ${file}`);
  return Number.parseFloat(result.stdout.trim());
}

function normalizeProductName(text) {
  return text.replace(/^Syn(?:ap|op)table/i, "SynapTable");
}

const voices = [];
for (let frame = 1; frame <= 5; frame += 1) {
  const stem = `voice-frame-${String(frame).padStart(2, "0")}`;
  const file = `assets/audio/${stem}.wav`;
  const duration = Number(durationOf(path.resolve(file)).toFixed(3));
  const rawWords = JSON.parse(await readFile(path.resolve(`assets/audio/${stem}.words.json`), "utf8"));
  const words = rawWords.map((word, index) => ({
    id: `f${frame}w${index}`,
    text: normalizeProductName(word.text),
    start: Number(Math.max(0, Math.min(duration, word.start)).toFixed(3)),
    end: Number(Math.max(0, Math.min(duration, word.end)).toFixed(3)),
  }));
  voices.push({ frame, path: file, duration_s: duration, words });
}

const payload = { bgm: null, bgm_pending: false, voices, sfx: [] };
await writeFile(path.resolve("audio_meta.json"), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(
  `audio_meta.json · ${voices.length} voices · ${voices.reduce((sum, voice) => sum + voice.duration_s, 0).toFixed(3)}s spoken\n`,
);
