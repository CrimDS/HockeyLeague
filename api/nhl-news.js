// api/hockey-news.js

// This endpoint fetches the latest hockey news headlines from ESPN's modern JSON API.
export default async function handler(req, res) {
    const apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news';

    try {
        console.log(`[Hockey News V2] Fetching news from: ${apiUrl}`);
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch news API. Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.articles || !Array.isArray(data.articles)) {
            throw new Error("Invalid data structure received from news API.");
        }

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const headlines = data.articles.map(article => {
            const pubDate = new Date(article.published);
            return {
                title: article.headline,
                link: article.links.web.href,
                pubDate: pubDate,
            };
        }).filter(item => {
            // Filter for items from the last 24 hours
            return item && item.pubDate >= twentyFourHoursAgo;
        });
        
        console.log(`[Hockey News V2] Found ${headlines.length} articles from the last 24 hours.`);
        res.status(200).json({ headlines });

    } catch (error) {
        console.error("[Hockey News V2] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch hockey news." });
    }
}

