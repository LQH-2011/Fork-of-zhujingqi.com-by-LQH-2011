#!/usr/bin/env node
/**
 * forum/rss.mjs — regenerate forum/rss.xml from the Zhujingqi forum.
 *
 * The forum is a static SPA; its posts live in Supabase and are served by an
 * edge function. RSS readers cannot execute JavaScript, so this script fetches
 * the latest posts from the same public API the SPA uses and writes a static
 * RSS 2.0 feed into forum/rss.xml. Run it whenever you want the feed refreshed
 * and commit the updated rss.xml (e.g. `node forum/rss.mjs && git add forum/rss.xml`).
 *
 * Usage:
 *   node forum/rss.mjs [--perPage 20] [--out forum/rss.xml] [--base https://zhujingqi.com]
 *
 * Dependencies: Node.js >= 18 (uses built-in fetch, no packages required).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Same endpoint the forum SPA uses (see API_BASE in forum/index.html).
const API_BASE = "https://hxlhrrllhvvazyhiuhvb.supabase.co/functions/v1";
const API_POSTS = `${API_BASE}/api/posts`;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EMOJI_DIR = path.join(SCRIPT_DIR, "emojis");

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PER_PAGE = Number(getArg("--perPage", "20")) || 20;
const OUT_FILE = path.resolve(SCRIPT_DIR, getArg("--out", "rss.xml"));
const SITE_BASE = getArg("--base", "https://zhujingqi.com");
const FEED_URL = `${SITE_BASE}/forum/rss.xml`;
const FORUM_URL = `${SITE_BASE}/forum/`;

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toRfc2822 = (iso) => {
  const d = new Date(String(iso).replace(/\.\d+(Z|[+-]\d{2}:?\d{2})$/, "$1"));
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString().replace("GMT", "+0000");
};

const emojiNames = new Set(
  readdirSync(EMOJI_DIR)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.slice(0, -4).toLowerCase())
);

// Convert raw post content to safe description HTML: escape text, keep line
// breaks, and turn :emoji: tokens into the same SVG images the forum renders.
const contentToHtml = (raw) => {
  const reg = /:([a-zA-Z0-9_-]+):/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = reg.exec(raw))) {
    out += escapeXml(raw.slice(last, m.index));
    const name = m[1].toLowerCase();
    if (emojiNames.has(name)) {
      out += `<img src="${FORUM_URL}emojis/${name}.svg" alt=":${name}:" width="18" height="18" />`;
    } else {
      out += `:${escapeXml(m[1])}:`;
    }
    last = m.index + m[0].length;
  }
  out += escapeXml(raw.slice(last));
  return out.replace(/\n/g, "<br />");
};

// Posts have no titles; derive one from the content (or the author's name).
const makeTitle = (post) => {
  const text = String(post.content || "")
    .replace(/:([a-zA-Z0-9_-]+):/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return post.users?.name || `Post ${post.id}`;
};

async function main() {
  console.log(`Fetching ${API_POSTS}?page=1&perPage=${PER_PAGE} …`);
  const res = await fetch(`${API_POSTS}?page=1&perPage=${PER_PAGE}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];

  const items = posts
    .map((p) => {
      const permalink = `${FORUM_URL}?pid=${p.id}`;
      const author = p.users?.name ? escapeXml(p.users.name) : "";
      const meta = [
        author ? `作者: ${author}` : "",
        p.tag ? `标签: ${escapeXml(p.tag)}` : "",
        `👍 ${p.likes ?? 0} / 👎 ${p.dislikes ?? 0}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const desc = `${contentToHtml(p.content || "")}${meta ? `<br /><br /><small>${meta}</small>` : ""}`;
      return `    <item>
      <title>${escapeXml(makeTitle(p))}</title>
      <link>${permalink}</link>
      <guid isPermaLink="true">${permalink}</guid>
      <pubDate>${toRfc2822(p.time)}</pubDate>
      <dc:creator>${author || escapeXml(String(p.author))}</dc:creator>
      <description>${desc}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Jacky 论坛 - Zhujingqi</title>
    <link>${FORUM_URL}</link>
    <description>Zhujingqi 论坛最新帖子 / Latest posts from the Jacky forum</description>
    <language>zh-CN</language>
    <lastBuildDate>${toRfc2822(new Date().toISOString())}</lastBuildDate>
    <ttl>60</ttl>
    <generator>forum/rss.mjs</generator>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  writeFileSync(OUT_FILE, xml, "utf8");
  console.log(`Wrote ${OUT_FILE} (${posts.length} items, ${data.count ?? "?"} total posts).`);
}

main().catch((err) => {
  console.error(`rss.mjs failed: ${err.message}`);
  process.exit(1);
});
