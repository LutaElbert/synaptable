import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("assets/audio/narration-orus.wav");
const transcriptPath = path.resolve("assets/audio/transcript.json");
const boundaries = [0, 11.912958, 21.348833, 33.326083, 48.268792, 58.352083, 73.447583, 82.2];
const words = JSON.parse(await readFile(transcriptPath, "utf8"));
const voices = [];

for (let frame = 1; frame <= 7; frame += 1) {
  const start = boundaries[frame - 1];
  const end = boundaries[frame];
  const duration = Number((end - start).toFixed(3));
  const file = `assets/audio/voice-frame-${String(frame).padStart(2, "0")}.wav`;
  const output = path.resolve(file);
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), "-t", String(duration), "-i", source, "-c:a", "pcm_s16le", output],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed for frame ${frame}`);

  const localWords = words
    .filter((word) => word.start < end && word.end > start)
    .map((word, index) => ({
      id: `f${frame}w${index}`,
      text: word.text,
      start: Number(Math.max(0, word.start - start).toFixed(3)),
      end: Number(Math.min(duration, word.end - start).toFixed(3)),
    }));

  voices.push({ frame, path: file, duration_s: duration, words: localWords });
}

await writeFile(
  path.resolve("audio_meta.json"),
  `${JSON.stringify({ bgm: null, bgm_pending: false, voices, sfx: [] }, null, 2)}\n`,
);
process.stdout.write(`audio_meta.json · ${voices.length} voices · ${boundaries.at(-1)}s\n`);
