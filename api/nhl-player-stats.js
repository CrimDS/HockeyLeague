// api/nhl-player-stats.js

// This is a complete rewrite for stability, using the single 'realtime' endpoint.
export default async function handler(req, res) {
    // 1. Determine the season to fetch
    const { season } = req.query;
    const seasonId = season || '20232024'; 


    // 2. Construct the single, reliable API URL
    const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=[{"property":"hits","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;


    try {
        console.log(`[V2] Fetching all player stats from REALTIME endpoint for season ${seasonId}...`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[V2] NHL API responded with status: ${response.status} for URL: ${url}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 3. Robust data validation
        // This is the most critical step to prevent crashes. If the API returns something
        // other than a list of players, we stop here and return an empty array.
        if (!data || !Array.isArray(data.data)) {
            console.warn("[V2] NHL API did not return the expected data array. The endpoint may be temporarily down or empty for this season.");
            return res.status(200).json([]); // Return empty list, not an error.
        }

        // 4. Map the raw API data to a clean, consistent format for our website
        const mappedStats = data.data.map(player => {
            // Construct a reliable headshot URL, with a fallback for missing data.
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            
            // Use nullish coalescing (??) to ensure no 'undefined' values make it to the page.
            // If a stat is missing from the API for a player, it will safely default to 0.
            return {
                id: player.playerId,
                name: player.skaterFullName,
                headshot: headshotUrl,
                team: player.teamAbbrevs || 'N/A',
                position: player.positionCode,
                gamesPlayed: player.gamesPlayed ?? 0,
                goals: player.goals ?? 0,
                assists: player.assists ?? 0,
                points: player.points ?? 0,
                plusMinus: player.plusMinus ?? 0,
                penaltyMinutes: String(player.penaltyMinutes ?? 0),
                powerPlayGoals: player.ppGoals ?? 0,
                hits: player.hits ?? 0,
                blockedShots: player.blockedShots ?? 0,
            };
        });

        console.log(`[V2] Processing complete. Found ${mappedStats.length} players.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("[V2] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

