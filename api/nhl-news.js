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
            // **FIX**: Add robust checking to prevent crashes if a link is missing.
            const link = article.links?.web?.href;
            if (!article.headline || !link) {
                return null; // Skip this article if it's missing a headline or link
            }

            const pubDate = new Date(article.published);
            return {
                title: article.headline,
                link: link,
                pubDate: pubDate,
            };
        }).filter(item => {
            // Filter for items from the last 24 hours and remove any nulls from the previous step
            return item && item.pubDate >= twentyFourHoursAgo;
        });
        
        console.log(`[Hockey News V2] Found ${headlines.length} articles from the last 24 hours.`);
        res.status(200).json({ headlines });

    } catch (error) {
        console.error("[Hockey News V2] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch hockey news." });
    }
}

