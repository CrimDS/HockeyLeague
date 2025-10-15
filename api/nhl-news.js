// This function fetches and parses an RSS feed for NHL news.
// Vercel Edge Functions are lightweight and fast, perfect for this.
export const config = {
  runtime: 'edge',
};

// The main handler for the serverless function.
export default async function handler(request) {
  console.log('API endpoint /api/nhl-news was called.'); // Log to confirm the function is running

  const RSS_URL = `https://www.espn.com/espn/rss/nhl/news`;

  try {
    // Fetch the XML data from the RSS feed.
    const response = await fetch(RSS_URL);
    console.log(`Fetched RSS feed from ESPN with status: ${response.status}`); // Log the response status

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
    }
    const xmlText = await response.text();

    // Manually parse the XML to extract news items.
    // This avoids needing heavy external libraries.
    const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    console.log(`Found ${items.length} news items in the RSS feed.`); // Log how many items were found
    
    const news = items.map(item => {
      const itemContent = item[1];
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)]]><\/title>/);
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      
      const title = titleMatch ? titleMatch[1] : 'No title available';
      const link = linkMatch ? linkMatch[1] : '#';

      return { title, link };
    }).filter(article => article.title && article.link !== '#'); // Ensure we only return valid articles

    // Return the parsed news items as JSON.
    return new Response(JSON.stringify({ articles: news }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in /api/nhl-news:', error); // Make the error message more specific
    return new Response(JSON.stringify({ error: 'Could not fetch news.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

