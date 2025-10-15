// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    // Default to the most recent full season if none is provided.
    const seasonId = season || '20232024'; 
    
    // **FIX**: Reverted to the more stable 'summary' endpoint, but incorporated 
    // the `limit=-1` parameter to ensure all players are fetched.
    const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    try {
        console.log(`Fetching player stats from SUMMARY NHL API URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`NHL API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.data)) {
            console.warn("NHL API did not return the expected data array. Response:", JSON.stringify(data));
            res.status(200).json([]);
            return;
        }

        const mappedStats = data.data.map(player => {
            // **FIX**: Added safety checks for headshot URL construction.
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            
            return {
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
                shotsOnGoal: player.shots,
                hits: player.hits ?? 0,
                powerPlayGoals: player.ppGoals,
                shortHandedGoals: player.shGoals,
                // **FIX**: The 'summary' endpoint uses 'blocks', so we switch back to that.
                blockedShots: player.blocks ?? 0,
            };
        });

        console.log(`Processing complete. Found ${mappedStats.length} players.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

