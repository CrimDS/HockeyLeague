// api/nhl-player-stats.js

// [V7] This is a complete rewrite based on the modern NHL API documentation.
// This version uses a single, stable endpoint and a robust data consolidation method.
export default async function handler(req, res) {
    // 1. Determine the season to fetch
    const { season } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)

    const currentSeasonId = currentMonth >= 9 
        ? `${currentYear}${currentYear + 1}` 
        : `${currentYear - 1}${currentYear}`;
    
    const seasonId = season || currentSeasonId;

    // 2. Construct the URL for the modern, stable API endpoint
    const url = `https://api-web.nhle.com/v1/skater-stats-leaders/${seasonId}/2`; // '2' for regular season

    try {
        console.log(`[V7] Fetching stats from modern NHL API for season ${seasonId}: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[V7] NHL API responded with status: ${response.status}. Body: ${errorBody}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 3. Robust data consolidation
        // The API provides stats in separate arrays (one for goals, one for hits, etc.).
        // We will merge them into a single, clean list.
        const playerStats = new Map();

        // Use a helper to process each stat category and update the master map
        const processCategory = (categoryData, statName) => {
            if (categoryData && Array.isArray(categoryData)) {
                for (const player of categoryData) {
                    if (!player || !player.id) continue;

                    // If we haven't seen this player yet, create a base record
                    if (!playerStats.has(player.id)) {
                        let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
                        if (player.teamAbbrevs && player.id) {
                            headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.id}.png`;
                        }
                        playerStats.set(player.id, {
                            id: player.id,
                            name: `${player.firstName.default} ${player.lastName.default}`,
                            headshot: headshotUrl,
                            team: player.teamAbbrevs || 'N/A',
                            position: player.positionCode || 'N/A',
                            gamesPlayed: 0, goals: 0, assists: 0, points: 0, plusMinus: 0,
                            penaltyMinutes: '0', powerPlayGoals: 0, hits: 0, blockedShots: 0,
                        });
                    }
                    // Update the specific stat for the player
                    playerStats.get(player.id)[statName] = player.value;
                }
            }
        };
        
        // Process all the categories we need from the API response
        processCategory(data.gamesPlayed, 'gamesPlayed');
        processCategory(data.goals, 'goals');
        processCategory(data.assists, 'assists');
        processCategory(data.points, 'points');
        processCategory(data.plusMinus, 'plusMinus');
        processCategory(data.penaltyMinutes, 'penaltyMinutes');
        processCategory(data.powerPlayGoals, 'powerPlayGoals');
        processCategory(data.hits, 'hits');
        processCategory(data.blockedShots, 'blockedShots');

        const consolidatedStats = Array.from(playerStats.values());
        
        console.log(`[V7] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V7] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

