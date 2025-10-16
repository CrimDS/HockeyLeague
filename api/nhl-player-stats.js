// api/nhl-player-stats.js

// [V12] Corrected Time On Ice to use per-game average.
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



    try {
        console.log(`[V12] Fetching bulk data for season ${seasonId}...`);
        
        // Fetch all four data sources simultaneously for efficiency
        const [summaryRes] = await Promise.all([
            fetch(summaryUrl),
        ]);

        if (!summaryRes.ok) {
            console.error(`[V12] Summary API failed with status: ${summaryRes.status}`);
            throw new Error(`The main player stats endpoint failed to respond.`);
        }

        const summaryData = await summaryRes.json();
        
        if (!summaryData || !Array.isArray(summaryData.data)) {
            console.warn("[V12] Main stats API did not return valid data. Returning empty.");
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
                hits: 0, 
                blockedShots: 0,
                timeOnIce: '0:00',
            });
        });

        const consolidatedStats = Array.from(playerStats.values());

        console.log(`[V12] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V12] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

