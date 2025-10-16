// api/nhl-player-stats.js

// [V9] Final version. This uses a comprehensive merging strategy to build a complete player list from all available stat categories.
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
        console.log(`[V9] Fetching stats from modern NHL API for season ${seasonId}: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[V9] NHL API responded with status: ${response.status}. Body: ${errorBody}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 3. Comprehensive Data Consolidation
        if (!data) {
            console.warn("[V9] API response was empty or invalid. Returning empty.");
            return res.status(200).json([]);
        }

        // The master map to hold all consolidated player data.
        const playerStats = new Map();

        // Helper function to process a stat category. It adds new players to the master map
        // if they don't exist yet, and then updates their specific stat.
        const processCategory = (categoryData, statName) => {
            if (categoryData && Array.isArray(categoryData)) {
                for (const player of categoryData) {
                    // Skip any invalid player entries
                    if (!player || !player.id) continue;

                    const playerId = player.id;

                    // If we haven't seen this player before, create a new entry for them.
                    if (!playerStats.has(playerId)) {
                        let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
                        if (player.teamAbbrevs && playerId) {
                            headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${playerId}.png`;
                        }
                        playerStats.set(playerId, {
                            id: playerId,
                            name: `${player.firstName.default} ${player.lastName.default}`,
                            headshot: headshotUrl,
                            team: player.teamAbbrevs || 'N/A',
                            position: player.positionCode || 'N/A',
                            // Initialize all stats to 0
                            gamesPlayed: 0, goals: 0, assists: 0, points: 0, plusMinus: 0,
                            penaltyMinutes: 0, powerPlayGoals: 0, hits: 0, blockedShots: 0,
                        });
                    }
                    
                    // Get the player record and update the specific stat.
                    const existingPlayer = playerStats.get(playerId);
                    existingPlayer[statName] = player.value;
                }
            }
        };

        // Process every single stat category to build a complete roster of all leaders.
        // This ensures players who are leaders in hits but not points are still included.
        processCategory(data.gamesPlayed, 'gamesPlayed');
        processCategory(data.goals, 'goals');
        processCategory(data.assists, 'assists');
        processCategory(data.points, 'points');
        processCategory(data.plusMinus, 'plusMinus');
        processCategory(data.penaltyMinutes, 'penaltyMinutes');
        processCategory(data.powerPlayGoals, 'powerPlayGoals');
        processCategory(data.hits, 'hits');
        processCategory(data.blockedShots, 'blockedShots');
        
        // Final conversion of penaltyMinutes to string for consistency
        for (const player of playerStats.values()) {
            player.penaltyMinutes = String(player.penaltyMinutes);
        }

        const consolidatedStats = Array.from(playerStats.values());

        console.log(`[V9] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V9] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

