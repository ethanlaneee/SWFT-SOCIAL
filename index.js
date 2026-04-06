import { generateWeeklyContent, saveToDrive, generateReply } from "./agent.js";
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

      // Preview each post
      for (const post of content.posts) {
        console.log(`\n[${post.platform.toUpperCase()}] Hook: ${post.hook_type}`);
        console.log(`Best time: ${post.best_time}`);
        console.log(`\n${post.content.slice(0, 200)}...`);
        console.log(`\n Image: ${post.image_prompt.slice(0, 100)}...`);
      }

      // Save to Google Drive
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

Examples:
  node index.js generate
  node index.js generate "missed calls cost contractors thousands"
  node index.js reply instagram "Does this work for small HVAC companies?" "SWFT AI agent for home service businesses"
      `);
    }
  }
}

main().catch(console.error);
