import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.1-flash-tts-preview";
const VOICE = "Orus";
const DEFAULT_SCRIPT = "SCRIPT.md";
const DEFAULT_OUTPUT = "assets/audio/narration-orus.wav";

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function extractTranscript(markdown) {
  const lines = markdown.split(/\r?\n/);
  const spoken = [];

  for (const line of lines) {
    const match = line.match(/^ {4}(.+\S)\s*$/);
    if (match) spoken.push(match[1]);
  }

  if (spoken.length === 0) {
    throw new Error("No indented narration lines were found in SCRIPT.md.");
  }

  return spoken;
}

function parsePcmMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(";").map((value) => value.trim());
  const [, format = ""] = fileType.split("/");
  const options = {
    numChannels: 1,
    sampleRate: 24000,
    bitsPerSample: 16,
  };

  if (/^L\d+$/i.test(format)) {
    options.bitsPerSample = Number.parseInt(format.slice(1), 10);
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((part) => part.trim());
    if (key === "rate" && Number.isFinite(Number(value))) {
      options.sampleRate = Number.parseInt(value, 10);
    }
    if ((key === "channels" || key === "channel") && Number.isFinite(Number(value))) {
      options.numChannels = Number.parseInt(value, 10);
    }
  }

  return options;
}

function createWavHeader(dataLength, { numChannels, sampleRate, bitsPerSample }) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

function ensureWav(audio, mimeType) {
  const extension = mime.getExtension(mimeType || "");
  if (extension === "wav" || mimeType?.toLowerCase().includes("wav")) return audio;

  const options = parsePcmMimeType(mimeType || "audio/L16;rate=24000");
  return Buffer.concat([createWavHeader(audio.length, options), audio]);
}

function toPcm(audio, mimeType) {
  if (mimeType?.toLowerCase().includes("wav") && audio.subarray(0, 4).toString() === "RIFF") {
    return audio.subarray(44);
  }
  return audio;
}

async function generateSection(ai, transcript, section, sectionCount) {
  const directorPrompt = `Read this single narration section based on the audio profile and director's note.

# Audio Profile
A smooth, premium product-demonstration voice.

# Director's note
Style: Polished and human, confident without hype.
Pace: Natural and deliberate.
Accent: American (General).
Arc position: Section ${section} of ${sectionCount}. Preserve a cohesive voice across sections. Begin thoughtful, become precise through the product proof, sound measured during safeguards, and finish concise and confident.
Pronunciation: Say "SynapTable" as "SIN-ap-table." Say "WebMCP" as "Web M C P." Treat punctuation as pacing guidance.

# Transcript
${transcript}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      temperature: 0.7,
      responseModalities: ["audio"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE },
        },
      },
    },
    contents: [{ role: "user", parts: [{ text: directorPrompt }] }],
  });

  const audioParts = [];
  let audioMimeType = "";
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (!part.inlineData?.data) continue;
    audioMimeType ||= part.inlineData.mimeType || "audio/L16;rate=24000";
    audioParts.push(Buffer.from(part.inlineData.data, "base64"));
  }

  if (audioParts.length === 0) throw new Error(`Gemini returned no audio for section ${section}.`);
  return { pcm: toPcm(Buffer.concat(audioParts), audioMimeType), mimeType: audioMimeType };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not available in the process environment.");
  }

  const scriptPath = path.resolve(readArg("--script", DEFAULT_SCRIPT));
  const outputPath = path.resolve(readArg("--output", DEFAULT_OUTPUT));
  const transcript = extractTranscript(await readFile(scriptPath, "utf8"));
  const ai = new GoogleGenAI({ apiKey });

  const segments = [];
  for (let index = 0; index < transcript.length; index += 1) {
    process.stdout.write(`section ${index + 1}/${transcript.length}\n`);
    segments.push(await generateSection(ai, transcript[index], index + 1, transcript.length));
  }

  const audioMimeType = segments[0].mimeType;
  const options = parsePcmMimeType(audioMimeType || "audio/L16;rate=24000");
  const pauseLength = Math.round(options.sampleRate * options.numChannels * (options.bitsPerSample / 8) * 0.28);
  const pause = Buffer.alloc(pauseLength);
  const joined = [];
  segments.forEach((segment, index) => {
    joined.push(segment.pcm);
    if (index < segments.length - 1) joined.push(pause);
  });

  const wav = ensureWav(Buffer.concat(joined), audioMimeType);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, wav);
  process.stdout.write(`${path.relative(process.cwd(), outputPath)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
