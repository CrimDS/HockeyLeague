// api/nhl-player-stats.js

// [V10] Final version. This uses the correct bulk data endpoints for the entire league, not just leaders.
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

    // 2. Construct URLs for the correct bulk data endpoints (`limit=-1`)
    const baseUrl = `https://api.nhle.com/stats/rest/en/skater`;
    const commonParams = `isAggregate=false&isGame=false&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    const summaryUrl = `${baseUrl}/summary?sort=[{"property":"points","direction":"DESC"}]&${commonParams}`;
    const hitsUrl = `${baseUrl}/hits?sort=[{"property":"hits","direction":"DESC"}]&${commonParams}`;
    const blocksUrl = `${baseUrl}/blocks?sort=[{"property":"blocks","direction":"DESC"}]&${commonParams}`;

    try {
        console.log(`[V10] Fetching bulk data for season ${seasonId}...`);
        
        // Fetch all three data sources simultaneously for efficiency
        const [summaryRes, hitsRes, blocksRes] = await Promise.all([
            fetch(summaryUrl),
            fetch(hitsUrl),
            fetch(blocksUrl)
        ]);

        if (!summaryRes.ok) {
            console.error(`[V10] Summary API failed with status: ${summaryRes.status}`);
            throw new Error(`The main player stats endpoint failed to respond.`);
        }

        const summaryData = await summaryRes.json();
        
        if (!summaryData || !Array.isArray(summaryData.data)) {
            console.warn("[V10] Main stats API did not return valid data. Returning empty.");
            return res.status(200).json([]);
        }

        // 3. Comprehensive Data Merging
        const playerStats = new Map();

        // Step 1: Build the master player list from the summary data.
        summaryData.data.forEach(player => {
            if (!player || !player.playerId) return;

            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            playerStats.set(player.playerId, {
                id: player.playerId,
                name: player.skaterFullName,
                headshot: headshotUrl,
                team: player.teamAbbrevs || 'N/A',
                position: player.positionCode,
                gamesPlayed: player.gamesPlayed,
                goals: player.goals,
                assists: player.assists,
                points: player.points,
                plusMinus: player.plusMinus,
                penaltyMinutes: String(player.penaltyMinutes),
                powerPlayGoals: player.ppGoals,
                hits: 0, // Initialize to 0
                blockedShots: 0, // Initialize to 0
            });
        });
        
        // Step 2: Merge hits data if the fetch was successful.
        if (hitsRes.ok) {
            const hitsData = await hitsRes.json();
            if (hitsData && Array.isArray(hitsData.data)) {
                hitsData.data.forEach(player => {
                    if (playerStats.has(player.playerId)) {
                        playerStats.get(player.playerId).hits = player.hits ?? 0;
                    }
                });
            }
        } else {
            console.warn(`[V10] Hits API endpoint failed with status ${hitsRes.status}. Hits will show as 0.`);
        }

        // Step 3: Merge blocked shots data if the fetch was successful.
        if (blocksRes.ok) {
            const blocksData = await blocksRes.json();
            if (blocksData && Array.isArray(blocksData.data)) {
                blocksData.data.forEach(player => {
                    if (playerStats.has(player.playerId)) {
                        playerStats.get(player.playerId).blockedShots = player.blocks ?? 0;
                    }
                });
            }
        } else {
             console.warn(`[V10] Blocks API endpoint failed with status ${blocksRes.status}. Blocks will show as 0.`);
        }

        const consolidatedStats = Array.from(playerStats.values());

        console.log(`[V10] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V10] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

