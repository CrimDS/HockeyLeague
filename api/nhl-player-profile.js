// api/nhl-player-profile.js

// This endpoint fetches detailed landing page data for a single player from the modern NHL API.
export default async function handler(req, res) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Player ID is required' });
    }

    const url = `https://api-web.nhle.com/v1/player/${id}/landing`;

    try {
        console.log(`[Player Profile] Fetching data for player ID ${id} from: ${url}`);
        
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Player Profile] API failed for ID ${id} with status: ${response.status}`);
            throw new Error(`Failed to fetch player profile. Status: ${response.status}`);
        }
        
        const data = await response.json();

        // The API returns a lot of data, we can simplify it for the frontend.
        // We will return the full object for now to allow for flexibility on the page.
        
        console.log(`[Player Profile] Successfully fetched data for ${data.firstName.default} ${data.lastName.default}`);
        res.status(200).json(data);

    } catch (error) {
        console.error(`[Player Profile] Critical error for ID ${id}:`, error.message);
        res.status(500).json({ error: "Could not fetch player profile.", details: error.message });
    }
}
