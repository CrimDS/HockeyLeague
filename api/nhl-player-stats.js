// api/nhl-player-stats.js

// This version adds a User-Agent header to mimic a browser request, which should prevent the API from blocking the fetch.
export default async function handler(req, res) {
    // 1. Determine the season to fetch
    const { season } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)

    const currentSeasonId = currentMonth >= 9 
        ? `${currentYear}${currentYear + 1}` 
        : `${currentYear - 1}${currentYear}`;
    
    // Use the user's selected season, or default to the current one.
    const seasonId = season || currentSeasonId;

    const url = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;
        
    try {
        console.log(`[V6] Attempting to fetch stats for season ${seasonId} from ${url}`);
        
        // **FIX**: Added a 'User-Agent' header to the fetch request.
        // This makes the request look like it's coming from a standard browser,
        // which is often required to prevent undocumented APIs from blocking server-side requests.
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[V6] NHL API responded with status: ${response.status}. Body: ${errorBody}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.data) || data.data.length === 0) {
            console.warn(`[V6] No players found for season ${seasonId}. The API returned an empty or invalid data array.`);
            return res.status(200).json([]);
        }

        const mappedStats = [];
        for (const player of data.data) {
            try {
                if (!player || typeof player !== 'object' || !player.playerId) {
                    console.warn('[V6] Skipping a malformed player entry:', player);
                    continue;
                }

                let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
                if (player.teamAbbrevs && player.playerId) {
                    headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
                }

                mappedStats.push({
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
                });
            } catch (e) {
                console.error(`[V6] Failed to process a single player record. Skipping.`, { player, error: e.message });
            }
        }
        
        console.log(`[V6] Processing complete. Successfully mapped ${mappedStats.length} out of ${data.data.length} players for season ${seasonId}.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("[V6] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

