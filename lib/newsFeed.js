// Free public RSS feeds used to ground each day's article in a real, current
// story instead of an invented topic. No API key required.
const FEEDS = {
  technology: [
    { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
    { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge' },
  ],
  politics: [
    { url: 'https://feeds.npr.org/1014/rss.xml', source: 'NPR Politics' },
    { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', source: 'BBC Politics' },
  ],
  culture: [
    { url: 'https://feeds.npr.org/1008/rss.xml', source: 'NPR Culture' },
    { url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', source: 'BBC Culture' },
  ],
};

export const TOPICS = Object.keys(FEEDS);

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let val = m[1];
  const cdata = val.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) val = cdata[1];
  return decodeEntities(stripTags(val)).trim();
}

function parseRss(xml) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return blocks
    .map((block) => ({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate'),
      description: extractTag(block, 'description'),
    }))
    .filter((it) => it.title && it.link);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Returns the most recent story for `topic` whose link isn't in `excludeLinks`,
// trying each configured feed in random order. Returns null if every feed
// fails or every story has already been used.
export async function fetchLatestStory(topic, excludeLinks = []) {
  const feeds = shuffle(FEEDS[topic] || []);
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; VocabNewsApp/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRss(xml)
        .filter((it) => !excludeLinks.includes(it.link))
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      if (items.length) {
        return { ...items[0], source: feed.source, topic };
      }
    } catch {
      continue; // try the next feed
    }
  }
  return null;
}
