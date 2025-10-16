// api/hockey-news.js

// This endpoint fetches the latest hockey news headlines from ESPN's RSS feed using robust parsing.
export default async function handler(req, res) {
    const rssUrl = 'https://www.espn.com/espn/rss/nhl/news';

    try {
        console.log(`[Hockey News V3] Fetching news from RSS feed: ${rssUrl}`);
        const response = await fetch(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
        }

        const xmlText = await response.text();
        
        // Robustly parse the XML to find all items
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const headlines = items.map(item => {
            try {
                // Use more flexible regex to capture content inside CDATA or regular tags
                const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
                const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
                const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

                if (titleMatch && linkMatch && pubDateMatch) {
                    const pubDate = new Date(pubDateMatch[1]);
                    // Only return the item if it was published in the last 24 hours
                    if (pubDate >= twentyFourHoursAgo) {
                        return {
                            title: titleMatch[1],
                            link: linkMatch[1],
                        };
                    }
                }
            } catch (e) {
                console.warn("Skipping a malformed RSS item:", e);
            }
            return null;
        }).filter(Boolean); // Filter out any null (skipped or old) items
        
        console.log(`[Hockey News V3] Found ${headlines.length} articles from the last 24 hours.`);
        res.status(200).json({ headlines });

    } catch (error) {
        console.error("[Hockey News V3] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch hockey news." });
    }
}

