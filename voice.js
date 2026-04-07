import { spawn } from "child_process";
import { nodewhisper } from "nodejs-whisper";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import os from "os";

const client = new Anthropic();

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function captureVoiceInput() {
  const tmpFile = path.join(os.tmpdir(), `swft-voice-${Date.now()}.wav`);

  try {
    await recordAudio(tmpFile);
    console.log("\n Transcribing with Whisper...");
    const raw = await transcribeAudio(tmpFile);
    if (!raw) throw new Error("No speech detected. Try again.");
    console.log(` Raw transcript: "${raw}"`);
    const clean = await cleanTranscript(raw);
    console.log(` Cleaned: "${clean}"\n`);
    return clean;
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ─── Audio Recording ──────────────────────────────────────────────────────────
// Uses `rec` from SoX — records mic input as 16kHz mono WAV (Whisper's required format)
// Install SoX: macOS → brew install sox | Linux → sudo apt install sox

function recordAudio(outputPath) {
  return new Promise((resolve, reject) => {
    let recording = null;

    const start = () => {
      // rec -r 16000 -c 1 -b 16 records 16kHz mono 16-bit WAV from default mic
      recording = spawn("rec", ["-r", "16000", "-c", "1", "-b", "16", outputPath]);

      recording.on("error", (err) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(
              "SoX not found. Install it first:\n  macOS:  brew install sox\n  Linux:  sudo apt install sox\n  Windows: https://sourceforge.net/projects/sox/"
            )
          );
        } else {
          reject(err);
        }
      });

      process.stdout.write(" Recording... (press Enter to stop)\n");

      process.stdin.once("data", () => {
        process.stdin.pause();
        recording.kill("SIGTERM");
      });

      recording.on("close", resolve);
    };

    process.stdout.write("\n Press Enter to start recording...");
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => {
      start();
    });
  });
}

// ─── Whisper Transcription ────────────────────────────────────────────────────
// Model is controlled by WHISPER_MODEL env var (default: base.en)
// Recommended upgrade path:  base.en → small.en → large-v3-turbo
// First run auto-downloads the model (~140MB for base.en, ~1.5GB for large-v3-turbo)

async function transcribeAudio(wavPath) {
  const model = process.env.WHISPER_MODEL || "base.en";

  const result = await nodewhisper(wavPath, {
    modelName: model,
    autoDownloadModelName: model,
    removeWavFileAfterTranscription: false,
    whisperOptions: {
      outputInText: true,
      language: "en",
      splitOnWord: true,
    },
  });

  return (result || "").trim();
}

// ─── Claude Transcript Cleanup ────────────────────────────────────────────────
// Mirrors what Wispr Flow does with Llama — but with Claude instead

async function cleanTranscript(rawText) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Clean up this voice transcript. Remove filler words (um, uh, like, you know, so), fix grammar, and return only the clean text. No explanation, no quotes.\n\nTranscript: ${rawText}`,
      },
    ],
  });

  return response.content[0].text.trim();
}
