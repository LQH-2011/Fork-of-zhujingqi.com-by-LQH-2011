#!/usr/bin/env node
/**
 * forum/rss.mjs — regenerate forum/rss.xml from the Zhujingqi forum.
 *
 * The forum is a static SPA; its posts live in Supabase and are served by an
 * edge function. RSS readers cannot execute JavaScript, so this script fetches
 * the latest posts (and their comments) from the same public APIs the SPA uses
 * and writes a static RSS 2.0 feed into forum/rss.xml. Run it whenever you want
 * the feed refreshed and commit the updated rss.xml (e.g.
 * `node forum/rss.mjs && git add forum/rss.xml`).
 *
 * The repository ships a GitHub Actions workflow (.github/workflows/forum-rss.yml)
 * that runs this script daily (16:00 UTC) and commits the refreshed feed.
 *
 * Usage:
 *   node forum/rss.mjs [--perPage 20] [--out forum/rss.xml] [--base https://zhujingqi.com]
 *
 * Dependencies: Node.js >= 18 (uses built-in fetch, no packages required).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Same endpoints the forum SPA uses (see API_BASE in forum/index.html).
const API_BASE = "https://hxlhrrllhvvazyhiuhvb.supabase.co/functions/v1";
const API_POSTS = `${API_BASE}/api/posts`;
const API_COMMENTS_BATCH = `${API_BASE}/api/comments/batch`;

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

// Convert raw post/comment text to description HTML. Text is inserted RAW
// (no escaping here) — the whole string is escaped exactly once when the
// <description> element is emitted. Raw <br>/<small>/<img>/<b> child elements
// inside <description> are invalid RSS 2.0 (description must be character
// data) and cause strict parsers like NetNewsWire's RSParser to reject items.
const contentToHtml = (raw) => {
  const reg = /:([a-zA-Z0-9_-]+):/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = reg.exec(raw))) {
    out += raw.slice(last, m.index);
    const name = m[1].toLowerCase();
    if (emojiNames.has(name)) {
      out += `<img src="${FORUM_URL}emojis/${name}.svg" alt=":${name}:" width="18" height="18" />`;
    } else {
      out += `:${m[1]}:`;
    }
    last = m.index + m[0].length;
  }
  out += raw.slice(last);
  return out.replace(/\n/g, "<br />");
};

// Comments may be replies; the content starts with "[reply:<parentId>] ".
const parseReply = (content) => {
  const m = String(content || "").match(/^\[reply:(\d+)\]\s*/);
  return m
    ? { parentId: Number(m[1]), text: content.slice(m[0].length) }
    : { parentId: null, text: content || "" };
};

// Fetch comments for every post in one batch call (same endpoint the SPA uses),
// grouped by post id and sorted chronologically. Reply targets are resolved
// afterwards against each post's own comment list.
async function fetchComments(posts) {
  if (!posts.length) return new Map();
  const res = await fetch(API_COMMENTS_BATCH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postIds: posts.map((p) => p.id) }),
  });
  if (!res.ok) throw new Error(`comments API returned ${res.status}: ${await res.text()}`);
  const list = await res.json();
  const byPost = new Map();
  for (const c of Array.isArray(list) ? list : []) {
    if (!byPost.has(c.postid)) byPost.set(c.postid, []);
    byPost.get(c.postid).push(c);
  }
  for (const arr of byPost.values()) {
    arr.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
  return byPost;
}

function commentsToHtml(comments) {
  if (!comments || !comments.length) return "";
  const nameById = new Map(comments.map((c) => [c.id, c.users?.name || null]));
  const lines = comments.map((c) => {
    const author = c.users?.name || "?";
    const { parentId, text } = parseReply(c.content);
    const parentName = parentId ? nameById.get(parentId) : null;
    const replyPrefix = parentName ? `回复 @${parentName} · ` : "";
    const when = String(c.time || "").replace("T", " ").replace(/\.\d+$/, "").slice(0, 16);
    const whenHtml = when ? ` <small style="color:#888">${when}</small>` : "";
    return `${replyPrefix}<b>${author}</b>: ${contentToHtml(text)}${whenHtml}`;
  });
  return `<br /><br /><b>💬 评论 (${comments.length})</b><br />${lines.join("<br />")}`;
}

// Posts have no titles; derive one from the content (or the author's name).
const makeTitle = (post) => {
  const text = String(post.content || "")
    .replace(/:([a-zA-Z0-9_-]+):/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return post.users?.name || `Post ${post.id}`;
};

function buildItem(post, comments) {
  const permalink = `${FORUM_URL}?pid=${post.id}`;
  const author = post.users?.name || String(post.author);
  const meta = [
    author ? `作者: ${author}` : "",
    post.tag ? `标签: ${post.tag}` : "",
    `👍 ${post.likes ?? 0} / 👎 ${post.dislikes ?? 0}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const descHtml = `${contentToHtml(post.content || "")}${meta ? `<br /><br /><small>${meta}</small>` : ""}${commentsToHtml(comments)}`;
  return `    <item>
      <title>${escapeXml(makeTitle(post))}</title>
      <link>${permalink}</link>
      <guid isPermaLink="true">${permalink}</guid>
      <pubDate>${toRfc2822(post.time)}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <description>${escapeXml(descHtml)}</description>
    </item>`;
}

async function main() {
  console.log(`Fetching ${API_POSTS}?page=1&perPage=${PER_PAGE} …`);
  const res = await fetch(`${API_POSTS}?page=1&perPage=${PER_PAGE}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];

  let commentsByPost = new Map();
  try {
    commentsByPost = await fetchComments(posts);
  } catch (err) {
    console.warn(`Warning: comments fetch failed (${err.message}); feed will omit comments.`);
  }
  const commentCount = [...commentsByPost.values()].reduce((n, a) => n + a.length, 0);

  const items = posts
    .map((p) => buildItem(p, commentsByPost.get(p.id) || []))
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
  console.log(
    `Wrote ${OUT_FILE} (${posts.length} items, ${commentCount} comments, ${data.count ?? "?"} total posts).`
  );
}

main().catch((err) => {
  console.error(`rss.mjs failed: ${err.message}`);
  process.exit(1);
});
