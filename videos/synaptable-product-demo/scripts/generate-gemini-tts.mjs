import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.1-flash-tts-preview";
const VOICE = "Orus";
const DEFAULT_SCRIPT = "SCRIPT.md";
const DEFAULT_OUTPUT = "assets/audio/narration-orus.wav";
const SECTION_PAUSE_SECONDS = 0.32;

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function extractSections(markdown) {
  const sections = [];
  const pattern = /## Line\s+(\d+)[^\n]*[\s\S]*?\*\*Delivery:\*\*\s*([^\n]+)[\s\S]*?\n {4}(.+\S)\s*(?=\n## Line|$)/g;
  for (const match of markdown.matchAll(pattern)) {
    sections.push({
      frame: Number.parseInt(match[1], 10),
      delivery: match[2].trim(),
      transcript: match[3].trim(),
    });
  }
  if (sections.length === 0) {
    throw new Error("No narrated sections were found in SCRIPT.md.");
  }
  return sections;
}

function parsePcmMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(";").map((value) => value.trim());
  const [, format = ""] = fileType.split("/");
  const options = { numChannels: 1, sampleRate: 24000, bitsPerSample: 16 };

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

function toPcm(audio, mimeType) {
  if (mimeType?.toLowerCase().includes("wav") && audio.subarray(0, 4).toString() === "RIFF") {
    return audio.subarray(44);
  }
  return audio;
}

function pcmToWav(pcm, options) {
  return Buffer.concat([createWavHeader(pcm.length, options), pcm]);
}

async function generateSection(ai, section, sectionCount) {
  const prompt = `Read this single narration section based on the audio profile and director's note.

# Audio Profile
A smooth, premium product-demo voice with the restraint and clarity of a best-in-class technology commercial.

# Director's note
Style: Polished, modern, observant, and human. Confident without sounding hyped.
Pace: Natural and deliberate, with clean breathing room around short sentences.
Accent: American (General).
Arc position: Section ${section.frame} of ${sectionCount}. Begin intrigued, become inviting as the canvas grows, sound precise at the product proof, and finish concise and assured.
Section direction: ${section.delivery}
Pronunciation: Say "SynapTable" as "SIN-ap-table." Never shout. Do not read stage directions aloud.

# Transcript
${section.transcript}`;

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
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const buffers = [];
  let mimeType = "";
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (!part.inlineData?.data) continue;
    mimeType ||= part.inlineData.mimeType || "audio/L16;rate=24000";
    buffers.push(Buffer.from(part.inlineData.data, "base64"));
  }
  if (buffers.length === 0) {
    throw new Error(`Gemini returned no audio for frame ${section.frame}.`);
  }
  return { ...section, mimeType, pcm: toPcm(Buffer.concat(buffers), mimeType) };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not available in the process environment.");
  }

  const scriptPath = path.resolve(readArg("--script", DEFAULT_SCRIPT));
  const outputPath = path.resolve(readArg("--output", DEFAULT_OUTPUT));
  const sections = extractSections(await readFile(scriptPath, "utf8"));
  const ai = new GoogleGenAI({ apiKey });
  const generated = [];

  await mkdir(path.dirname(outputPath), { recursive: true });
  for (const section of sections) {
    process.stdout.write(`Generating frame ${section.frame}/${sections.length}…\n`);
    const result = await generateSection(ai, section, sections.length);
    const options = parsePcmMimeType(result.mimeType || "audio/L16;rate=24000");
    const framePath = path.join(path.dirname(outputPath), `voice-frame-${String(section.frame).padStart(2, "0")}.wav`);
    await writeFile(framePath, pcmToWav(result.pcm, options));
    process.stdout.write(`${path.relative(process.cwd(), framePath)}\n`);
    generated.push({ ...result, options });
  }

  const baseOptions = generated[0].options;
  const pauseLength = Math.round(
    baseOptions.sampleRate * baseOptions.numChannels * (baseOptions.bitsPerSample / 8) * SECTION_PAUSE_SECONDS,
  );
  const joined = [];
  generated.forEach((section, index) => {
    joined.push(section.pcm);
    if (index < generated.length - 1) joined.push(Buffer.alloc(pauseLength));
  });
  await writeFile(outputPath, pcmToWav(Buffer.concat(joined), baseOptions));
  process.stdout.write(`${path.relative(process.cwd(), outputPath)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
