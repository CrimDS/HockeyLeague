// api/nhl-player-stats.js

// [V8] This version uses a more robust data consolidation strategy to prevent "all zeros" errors.
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
        console.log(`[V8] Fetching stats from modern NHL API for season ${seasonId}: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[V8] NHL API responded with status: ${response.status}. Body: ${errorBody}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 3. Robust Data Consolidation
        // If gamesPlayed is missing, we can't build a list, so return empty.
        if (!data || !Array.isArray(data.gamesPlayed)) {
            console.warn("[V8] API response is missing the essential 'gamesPlayed' data. Returning empty.");
            return res.status(200).json([]);
        }

        // Helper function to create efficient { playerId: value } lookup maps for each stat.
        const createStatMap = (categoryData) => {
            const statMap = new Map();
            if (categoryData && Array.isArray(categoryData)) {
                for (const player of categoryData) {
                    if (player && player.id) {
                        statMap.set(player.id, player.value);
                    }
                }
            }
            return statMap;
        };

        // Create a lookup map for every stat category.
        const goalsMap = createStatMap(data.goals);
        const assistsMap = createStatMap(data.assists);
        const pointsMap = createStatMap(data.points);
        const plusMinusMap = createStatMap(data.plusMinus);
        const penaltyMinutesMap = createStatMap(data.penaltyMinutes);
        const powerPlayGoalsMap = createStatMap(data.powerPlayGoals);
        const hitsMap = createStatMap(data.hits);
        const blockedShotsMap = createStatMap(data.blockedShots);

        // Build the final list using gamesPlayed as the source of truth for our roster.
        const consolidatedStats = [];
        for (const player of data.gamesPlayed) {
            if (!player || !player.id) continue;

            const playerId = player.id;
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${playerId}.png`;
            }

            consolidatedStats.push({
                id: playerId,
                name: `${player.firstName.default} ${player.lastName.default}`,
                headshot: headshotUrl,
                team: player.teamAbbrevs || 'N/A',
                position: player.positionCode || 'N/A',
                gamesPlayed: player.value ?? 0,
                // Look up each stat in its respective map. Default to 0 if not found.
                goals: goalsMap.get(playerId) ?? 0,
                assists: assistsMap.get(playerId) ?? 0,
                points: pointsMap.get(playerId) ?? 0,
                plusMinus: plusMinusMap.get(playerId) ?? 0,
                penaltyMinutes: String(penaltyMinutesMap.get(playerId) ?? 0),
                powerPlayGoals: powerPlayGoalsMap.get(playerId) ?? 0,
                hits: hitsMap.get(playerId) ?? 0,
                blockedShots: blockedShotsMap.get(playerId) ?? 0,
            });
        }

        console.log(`[V8] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V8] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

