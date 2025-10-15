// This function fetches and parses an RSS feed for NHL news from the current day.
// Vercel Edge Functions are lightweight and fast, perfect for this.
export const config = {
  runtime: 'edge',
};

// The main handler for the serverless function.
export default async function handler(request) {
  console.log('API endpoint /api/nhl-news was called.');

  const RSS_URL = `https://www.espn.com/espn/rss/nhl/news`;

  try {
    // Fetch the XML data from the RSS feed.
    const response = await fetch(RSS_URL);
    console.log(`Fetched RSS feed from ESPN with status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
    }
    const xmlText = await response.text();

    // Manually parse the XML to extract news items.
    const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    console.log(`Found ${items.length} total news items in the RSS feed.`);
    
    // Get the current date in UTC to ensure consistent comparison.
    const today = new Date();
    const todayYear = today.getUTCFullYear();
    const todayMonth = today.getUTCMonth();
    const todayDate = today.getUTCDate();

    const news = items.map(item => {
      const itemContent = item[1];
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)]]><\/title>/);
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/); // Extract publication date

      const title = titleMatch ? titleMatch[1] : null;
      const link = linkMatch ? linkMatch[1] : null;
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : null;

      return { title, link, pubDate };
    }).filter(article => {
      // Keep the article only if it's valid and its publication date matches today's date.
      if (!article.title || !article.link || !article.pubDate) {
        return false;
      }
      
      const articleYear = article.pubDate.getUTCFullYear();
      const articleMonth = article.pubDate.getUTCMonth();
      const articleDate = article.pubDate.getUTCDate();

      return articleYear === todayYear && articleMonth === todayMonth && articleDate === todayDate;
    });

    console.log(`Filtered down to ${news.length} news items from today.`);

    // Return the parsed news items as JSON.
    return new Response(JSON.stringify({ articles: news }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=59', // Cache for 30 minutes
      },
    });

  } catch (error) {
    console.error('Error in /api/nhl-news:', error);
    return new Response(JSON.stringify({ error: 'Could not fetch news.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

