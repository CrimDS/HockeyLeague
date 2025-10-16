// api/hockey-news.js

// This endpoint fetches the latest hockey news headlines from ESPN's RSS feed.
export default async function handler(req, res) {
    const rssUrl = 'https://www.espn.com/espn/rss/nhl/news';

    try {
        console.log(`[Hockey News] Fetching news from: ${rssUrl}`);
        // **FIX**: Added a 'User-Agent' header to mimic a browser request.
        const response = await fetch(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
        }

        const xmlText = await response.text();
        
        // Basic XML parsing to extract items
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const headlines = items.map(item => {
            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
            const linkMatch = item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/);
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

            if (titleMatch && linkMatch && pubDateMatch) {
                const pubDate = new Date(pubDateMatch[1]);
                return {
                    title: titleMatch[1],
                    link: linkMatch[1],
                    pubDate: pubDate,
                };
            }
            return null;
        }).filter(item => {
            // Filter for items from the last 24 hours
            return item && item.pubDate >= twentyFourHoursAgo;
        });
        
        console.log(`[Hockey News] Found ${headlines.length} articles from the last 24 hours.`);
        res.status(200).json({ headlines });

    } catch (error) {
        console.error("[Hockey News] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch hockey news." });
    }
}

