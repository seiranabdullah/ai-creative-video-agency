// The 8 AI employees: what each one does, what it reads, and the prompt it sends to the AI.

function brandBlock(cfg) {
  const c = cfg.client;
  return [
    `Agency: ${cfg.agency}`,
    `Client brand: ${c.brand}`,
    `Product: ${c.product}`,
    `Target audience: ${c.audience}`,
    `Campaign goal: ${c.goal}`,
    `Tone: ${c.tone}`,
    `Platforms: ${c.platforms.join(", ")}`,
    `Brand rules:\n- ${c.brand_rules.join("\n- ")}`,
  ].join("\n");
}

const STYLE = "Write in clear, simple English (short sentences). Use Markdown with headings, short lists and tables. Keep the whole answer under 450 words. Do not invent real people's names; use placeholders like [Creator 1].";

const cut = (s, n = 2500) => (s && s.length > n ? s.slice(0, n) + "\n..." : s || "(not available yet)");

export const AGENTS = {
  "market-researcher": {
    task: "Researched trends, competitors and the target audience",
    file: "01-market-research.md",
    needs: [],
    prompt: (cfg) => `You are the Market Researcher in an AI marketing agency.\n${brandBlock(cfg)}\n\nTask: write a short market research brief for the campaign with these sections:\n1. Audience: 3 audience insights (what they like, where they watch videos).\n2. Trends: 5 short-video trends or formats that fit this product right now.\n3. Competitors: 3 typical competitor types and what they do well.\n4. Opportunities: 3 clear ideas the brand can use.\n${STYLE}`,
  },
  "marketing-coordinator": {
    task: "Built the campaign plan and 7-day content calendar",
    file: "02-campaign-plan.md",
    needs: ["market-researcher"],
    prompt: (cfg, prev) => `You are the Marketing Coordinator in an AI marketing agency.\n${brandBlock(cfg)}\n\nMarket research from your teammate:\n${cut(prev["market-researcher"])}\n\nTask: write the campaign plan:\n1. Campaign name and one-sentence big idea.\n2. 3 key messages.\n3. A 7-day content calendar as a table with columns: Day | Platform | Video idea | Goal.\n4. 3 KPIs to measure (with simple targets).\n${STYLE}`,
  },
  copywriter: {
    task: "Wrote video scripts, hooks and captions",
    file: "03-scripts-and-captions.md",
    needs: ["marketing-coordinator"],
    prompt: (cfg, prev) => `You are the Copywriter in an AI marketing agency.\n${brandBlock(cfg)}\n\nCampaign plan from the Marketing Coordinator:\n${cut(prev["marketing-coordinator"])}\n\nTask: write content for the first 2 videos of the calendar. For each video give:\n- Title\n- Hook (first 2 seconds)\n- Script as a table: Time | What we see | Voice-over / text on screen (15-30 seconds total)\n- Caption with 3-5 hashtags\nAlso give 3 extra hook ideas.\n${STYLE}`,
  },
  "graphic-designer": {
    task: "Created the design brief and AI image prompts",
    file: "04-design-brief.md",
    needs: ["copywriter"],
    prompt: (cfg, prev) => `You are the Graphic Designer in an AI marketing agency. You do not draw; you prepare the design brief and prompts for AI image tools.\n${brandBlock(cfg)}\n\nScripts from the Copywriter:\n${cut(prev.copywriter)}\n\nTask: write:\n1. Visual style guide: colors (with hex codes), fonts, mood (3 bullets each).\n2. 4 ready-to-use AI image prompts (for a thumbnail, a product shot, a social post, a story background). Each prompt in a code block, with size/aspect ratio.\n3. A checklist of 4 design rules for the campaign.\n${STYLE}`,
  },
  "video-editor": {
    task: "Prepared the storyboard, shot list and edit plan",
    file: "05-storyboard-and-edit-plan.md",
    needs: ["copywriter", "graphic-designer"],
    prompt: (cfg, prev) => `You are the Video Editor in an AI marketing agency. You prepare the plan; a human or an AI video tool does the final edit.\n${brandBlock(cfg)}\n\nScripts from the Copywriter:\n${cut(prev.copywriter, 1800)}\n\nDesign brief from the Graphic Designer:\n${cut(prev["graphic-designer"], 1200)}\n\nTask: for Video 1 write:\n1. Storyboard table: Scene | Seconds | Shot (close-up, wide...) | On-screen text | Music/sound.\n2. Shot list for the filming day (6-8 items).\n3. Edit plan: cuts, transitions, subtitles, export settings (9:16, 1080x1920).\n4. 2 AI video prompts for a tool like Runway or Sora.\n${STYLE}`,
  },
  "social-media-manager": {
    task: "Adapted posts per platform and drafted replies",
    file: "06-social-posting-and-replies.md",
    needs: ["copywriter", "marketing-coordinator"],
    prompt: (cfg, prev) => `You are the Social Media Manager in an AI marketing agency.\n${brandBlock(cfg)}\n\nScripts and captions from the Copywriter:\n${cut(prev.copywriter, 1800)}\n\nTask:\n1. Posting plan for Video 1: a table with Platform | Best time | Caption version | Hashtags.\n2. Check each caption against the brand rules and say "OK" or what to fix.\n3. Here are 4 sample comments from followers. Sort each one (Question / Praise / Complaint / Spam) and draft a short, friendly reply:\n   a) "Where can I buy this in Riga?"\n   b) "Too sweet for me :("\n   c) "Love the can design!!"\n   d) "Check my profile for free followers"\n${STYLE}`,
  },
  "sales-partnerships-manager": {
    task: "Built the influencer and partner outreach list",
    file: "07-partnerships-outreach.md",
    needs: ["market-researcher"],
    prompt: (cfg, prev) => `You are the Sales & Partnerships Manager in an AI marketing agency.\n${brandBlock(cfg)}\n\nMarket research from your teammate:\n${cut(prev["market-researcher"], 1500)}\n\nTask:\n1. A table of 6 partner profiles to contact (do not use real names; use types like "student fitness creator, 20-50k followers"): Partner type | Platform | Why a good fit | Offer.\n2. 2 B2B leads types (for example campus cafes, coworking spaces) with an offer.\n3. One short outreach message template (under 90 words) with placeholders.\n${STYLE}`,
  },
};

export const ORDER = ["market-researcher", "marketing-coordinator", "copywriter", "graphic-designer", "video-editor", "social-media-manager", "sales-partnerships-manager"];

// Used by --demo mode so the whole pipeline can be shown without an API key.
export function demoText(id, cfg) {
  const name = cfg.agents.find((a) => a.id === id)?.name || id;
  return `# ${name}: demo output\n\n(Demo mode: this file shows the structure. Run without --demo to let Gemini write the real content for ${cfg.client.brand}.)\n\n- Task: ${AGENTS[id]?.task}\n- Client: ${cfg.client.brand}\n- Goal: ${cfg.client.goal}\n`;
}
