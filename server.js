import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { generateWeeklyContent, generateReply } from "./agent.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Basic auth (set BASIC_AUTH_USER + BASIC_AUTH_PASS env vars to enable) ────
if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Basic ")) {
      const [user, pass] = Buffer.from(auth.slice(6), "base64").toString().split(":");
      if (user === process.env.BASIC_AUTH_USER && pass === process.env.BASIC_AUTH_PASS) {
        return next();
      }
    }
    res.set("WWW-Authenticate", 'Basic realm="SWFT Social Agent"');
    res.status(401).send("Unauthorized");
  });
}

app.use(express.static(path.join(__dirname, "public")));

// ── Generate content ──────────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  try {
    const { topic } = req.body;
    const content = await generateWeeklyContent(topic || null);
    res.json({ ok: true, data: content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Generate reply ────────────────────────────────────────────────────────────
app.post("/api/reply", async (req, res) => {
  try {
    const { platform, comment, context } = req.body;
    if (!platform || !comment) {
      return res.status(400).json({ ok: false, error: "platform and comment are required" });
    }
    const reply = await generateReply(
      platform,
      comment,
      context || "SWFT AI CRM for home service businesses"
    );
    res.json({ ok: true, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n SWFT Social Agent running at http://localhost:${PORT}\n`);
});
