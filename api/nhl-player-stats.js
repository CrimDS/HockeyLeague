// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)
    const defaultSeasonId = currentMonth >= 9 ? `${currentYear}${currentYear + 1}` : `${currentYear - 1}${currentYear}`;
    const seasonId = season || defaultSeasonId; 
    
    // **FIX**: Reverting to the single, more complete 'realtime' endpoint based on user feedback.
    // This endpoint contains all necessary stats in one call, including banger stats.
    const url = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    try {
        console.log(`Fetching all player stats from REALTIME endpoint for season ${seasonId}...`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`NHL API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.data)) {
            console.warn("NHL API did not return the expected data array. Response:", JSON.stringify(data));
            return res.status(200).json([]);
        }

        const mappedStats = data.data.map(player => {
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            
            // **FIX**: Map all stats directly from the single data source with nullish coalescing (??)
            // to prevent 'undefined' values from appearing on the front end.
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

        console.log(`Processing complete. Found ${mappedStats.length} players.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

