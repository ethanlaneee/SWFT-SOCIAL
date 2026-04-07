import { generateWeeklyContent, saveToDrive, generateReply } from "./agent.js";
import { captureVoiceInput } from "./voice.js";
import dotenv from "dotenv";
dotenv.config();

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    // ── Generate weekly content batch ──────────────────────────────────────
    case "generate": {
      const topic = args[1] || null;
      console.log(`\n SWFT Content Agent Starting...`);
      console.log(topic ? ` Topic: ${topic}` : " Mode: Auto (trending topics)\n");

      const content = await generateWeeklyContent(topic);

      console.log(`\n Generated ${content.posts.length} posts about: "${content.topic}"`);
      console.log("─".repeat(50));

      for (const post of content.posts) {
        console.log(`\n[${post.platform.toUpperCase()}] Hook: ${post.hook_type}`);
        console.log(`Best time: ${post.best_time}`);
        console.log(`\n${post.content.slice(0, 200)}...`);
        console.log(`\n Image: ${post.image_prompt.slice(0, 100)}...`);
      }

      if (process.env.GDRIVE_ENABLED === "true") {
        console.log("\n Saving to Google Drive...");
        const folderId = await saveToDrive(content);
        console.log(`\n Done! Review your content in Google Drive.`);
        console.log(`   Folder ID: ${folderId}`);
      } else {
        console.log("\n Saving locally (GDRIVE_ENABLED not set)...");
        const fs = await import("fs");
        fs.writeFileSync(
          `./output-${Date.now()}.json`,
          JSON.stringify(content, null, 2)
        );
        console.log(" Saved to local JSON file.");
      }
      break;
    }

    // ── Generate a reply to a comment ─────────────────────────────────────
    case "reply": {
      const platform = args[1];
      const comment = args[2];
      const postContext = args[3] || "SWFT AI CRM for home service businesses";

      if (!platform || !comment) {
        console.log("Usage: node index.js reply <platform> <comment> [post-context]");
        console.log('Example: node index.js reply instagram "How much does it cost?" "SWFT helps contractors stop losing leads"');
        break;
      }

      console.log(`\n Generating ${platform} reply...`);
      const reply = await generateReply(platform, comment, postContext);
      console.log(`\nReply:\n${reply}`);
      break;
    }

    // ── Voice: speak a topic → generate posts ─────────────────────────────
    case "voice": {
      const subCommand = args[1];

      if (subCommand === "reply") {
        const platform = args[2] || "instagram";
        const postContext = args[3] || "SWFT AI CRM for home service businesses";

        console.log(`\n SWFT Voice Mode — Reply (${platform})`);
        console.log(" Speak the comment you want to reply to.");

        const comment = await captureVoiceInput();
        if (!comment) { console.log("No input captured."); break; }

        console.log(` Generating ${platform} reply...`);
        const reply = await generateReply(platform, comment, postContext);
        console.log(`\nReply:\n${reply}`);
      } else {
        console.log(`\n SWFT Voice Mode — Content Generation`);
        console.log(" Speak your topic (e.g. 'HVAC maintenance tips for spring').");

        const topic = await captureVoiceInput();
        if (!topic) { console.log("No input captured."); break; }

        console.log(` SWFT Content Agent Starting...`);
        console.log(` Topic: ${topic}\n`);

        const content = await generateWeeklyContent(topic);

        console.log(`\n Generated ${content.posts.length} posts about: "${content.topic}"`);
        console.log("─".repeat(50));

        for (const post of content.posts) {
          console.log(`\n[${post.platform.toUpperCase()}] Hook: ${post.hook_type}`);
          console.log(`Best time: ${post.best_time}`);
          console.log(`\n${post.content.slice(0, 200)}...`);
          console.log(`\n Image: ${post.image_prompt.slice(0, 100)}...`);
        }

        if (process.env.GDRIVE_ENABLED === "true") {
          console.log("\n Saving to Google Drive...");
          const folderId = await saveToDrive(content);
          console.log(`\n Done! Review your content in Google Drive.`);
          console.log(`   Folder ID: ${folderId}`);
        } else {
          console.log("\n Saving locally (GDRIVE_ENABLED not set)...");
          const fs = await import("fs");
          fs.writeFileSync(
            `./output-${Date.now()}.json`,
            JSON.stringify(content, null, 2)
          );
          console.log(" Saved to local JSON file.");
        }
      }
      break;
    }

    // ── Help ───────────────────────────────────────────────────────────────
    default: {
      console.log(`
╔══════════════════════════════════════╗
║     SWFT Social Media Agent          ║
║     simple. smart. swft.             ║
╚══════════════════════════════════════╝

Commands:

  node index.js generate
    Auto-finds trending topics and generates this week's posts
    for Instagram, Facebook, and LinkedIn

  node index.js generate "your topic"
    Generate posts about a specific topic

  node index.js reply <platform> "<comment>" "<post context>"
    Generate a reply to a comment

  node index.js voice
    Speak your topic — Whisper transcribes it, Claude cleans it up,
    then generates posts automatically

  node index.js voice reply <platform>
    Speak a comment to reply to (platform defaults to instagram)

Examples:
  node index.js generate
  node index.js generate "missed calls cost contractors thousands"
  node index.js reply instagram "Does this work for small HVAC companies?" "SWFT AI agent for home service businesses"
  node index.js voice
  node index.js voice reply instagram

Voice setup (first time):
  Install SoX:   macOS → brew install sox  |  Linux → sudo apt install sox
  Set model:     WHISPER_MODEL=large-v3-turbo (optional, default: base.en)
      `);
    }
  }
}

main().catch(console.error);
