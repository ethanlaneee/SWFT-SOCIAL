import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();

// ─── SWFT Brand System Prompt ────────────────────────────────────────────────

const SWFT_SYSTEM_PROMPT = `
You are SWFT's social media content agent. SWFT is an AI-powered CRM for home service businesses (HVAC, plumbing, roofing, landscaping, etc.).

BRAND VOICE:
- Tagline: "simple. smart. swft."
- Tone: Direct, confident, no fluff. Talk like a sharp contractor who also understands tech.
- Never sound corporate. Never sound like a startup trying to be cool.
- Speak TO Jake Reynolds (trades owner, 50s, non-technical, busy, skeptical of tech)

CONTENT PILLARS:
1. Missed calls = lost money (core pain point)
2. AI does the work, you just show up
3. Setup takes 10 minutes, not 10 days
4. Real stories, real numbers, real results

HIGH-RETENTION HOOK RULES:
- First line must stop the scroll. Use pattern interrupts, bold claims, or open loops.
- Never start with "I" or the brand name
- Create curiosity gaps that DEMAND the next line
- Use compression — every word earns its place
- End with a payoff that delivers on the hook's promise

PLATFORM FORMATS:

INSTAGRAM:
- Hook (1-2 lines, scroll-stopper)
- Body (3-5 short punchy lines, lots of white space)
- CTA (one clear action)
- 5-10 hashtags (mix of niche + broad)
- Keep under 300 words total

FACEBOOK:
- Slightly longer, more conversational
- Can tell a short story (contractor lost X, here's what happened)
- End with a question to drive comments
- 2-3 hashtags max

LINKEDIN:
- Professional but still direct
- Lead with a stat or bold insight
- Structured with line breaks
- Talk to business owners, not employees
- End with a thought-provoking question

OUTPUT FORMAT:
Always respond with valid JSON only. No markdown, no preamble. Structure:
{
  "topic": "what this content is about",
  "week": "YYYY-WW",
  "posts": [
    {
      "platform": "instagram" | "facebook" | "linkedin",
      "content": "full post text",
      "hashtags": ["tag1", "tag2"],
      "image_prompt": "detailed prompt for AI image generation",
      "best_time": "e.g. Tuesday 9am MT",
      "hook_type": "pattern_interrupt | curiosity_gap | bold_claim | open_loop"
    }
  ]
}
`;

// ─── Generate Content ─────────────────────────────────────────────────────────

export async function generateWeeklyContent(customTopic = null) {
  console.log(" Searching for trending topics...");

  const userPrompt = customTopic
    ? `Generate high-retention social media posts for SWFT about: "${customTopic}".
      Create one post for each platform: Instagram, Facebook, LinkedIn.
      Use web search to find relevant current stats or stories to ground the content in real data.`
    : `Search the web for what's trending right now in:
      1. Home service businesses (HVAC, plumbing, roofing, landscaping)
      2. Small business AI tools and automation
      3. Contractor pain points and business challenges

      Then generate this week's social media content for SWFT.
      Create one post per platform (Instagram, Facebook, LinkedIn).
      Ground each post in real current data you find — specific numbers, recent stories, or stats.
      Make the hooks impossible to scroll past.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    system: SWFT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract the final text response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) throw new Error("No text response from agent");

  // Parse JSON response
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  const contentData = JSON.parse(clean);

  return contentData;
}

// ─── Save to Google Drive ─────────────────────────────────────────────────────

export async function saveToDrive(contentData) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  // Create folder name for this week
  const folderName = `SWFT Content - Week ${contentData.week}`;

  // Check if folder exists or create it
  const folderSearch = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });

  let folderId;
  if (folderSearch.data.files.length > 0) {
    folderId = folderSearch.data.files[0].id;
    console.log(` Using existing folder: ${folderName}`);
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [process.env.GDRIVE_PARENT_FOLDER_ID || "root"],
      },
    });
    folderId = folder.data.id;
    console.log(` Created folder: ${folderName}`);
  }

  // Save each post as a separate text file
  for (const post of contentData.posts) {
    const fileName = `${post.platform.toUpperCase()} - ${contentData.topic.slice(0, 40)}.txt`;
    const fileContent = formatPostForDrive(post, contentData);

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: "text/plain",
      body: fileContent,
    };

    await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, webViewLink",
    });

    console.log(` Saved: ${fileName}`);
  }

  // Save full JSON for posting agent to use
  const jsonFile = {
    name: `_content_data.json`,
    parents: [folderId],
  };

  await drive.files.create({
    requestBody: jsonFile,
    media: {
      mimeType: "application/json",
      body: JSON.stringify(contentData, null, 2),
    },
    fields: "id",
  });

  console.log(`\n All content saved to Google Drive folder: ${folderName}`);
  console.log(` Folder ID: ${folderId}`);

  return folderId;
}

// ─── Format Post for Drive ────────────────────────────────────────────────────

function formatPostForDrive(post, contentData) {
  return `
SWFT SOCIAL MEDIA CONTENT
==========================
Platform: ${post.platform.toUpperCase()}
Topic: ${contentData.topic}
Week: ${contentData.week}
Hook Type: ${post.hook_type}
Best Time to Post: ${post.best_time}

--- POST CONTENT ---

${post.content}

${post.hashtags?.length ? `\nHashtags: ${post.hashtags.map((h) => `#${h}`).join(" ")}` : ""}

--- IMAGE PROMPT ---

${post.image_prompt}

==========================
STATUS: PENDING APPROVAL
Delete this file to skip posting, or move to /Approved to queue for posting.
  `.trim();
}

// ─── Generate Reply to Comment ────────────────────────────────────────────────

export async function generateReply(platform, commentText, postContext) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: `${SWFT_SYSTEM_PROMPT}

You are replying to a comment on SWFT's ${platform} post.
Be conversational, warm but not fake. Keep replies short (1-3 lines max).
Never be defensive. Always move toward a conversation or a CTA.
Respond with just the reply text, no JSON needed.`,
    messages: [
      {
        role: "user",
        content: `Post context: "${postContext}"\n\nComment to reply to: "${commentText}"\n\nWrite a reply:`,
      },
    ],
  });

  return response.content[0].text;
}
