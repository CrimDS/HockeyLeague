// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    // Default to the most recent full season if none is provided.
    const seasonId = season || '20232024'; 
    
    // Switched to the `realtime` endpoint and added `limit=-1` to fetch all players.
    // Also added `gameTypeId=2` to ensure we only get regular season stats.
    const url = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    try {
        console.log(`Fetching player stats from REALTIME NHL API URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`NHL API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // **FIX**: Add a safety check to ensure the data structure is valid before processing.
        // If data.data is not a valid array, the API has returned an unexpected format.
        if (!data || !Array.isArray(data.data)) {
            console.warn("NHL API did not return the expected data array. Response:", JSON.stringify(data));
            // Return an empty array to prevent a crash, which will result in a "No Players Found" message on the front end.
            res.status(200).json([]);
            return;
        }

        // The new API has a different structure. We need to map the fields.
        const mappedStats = data.data.map(player => {
            // Manually construct a more reliable headshot URL.
            const headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            
            return {
                id: player.playerId,
                name: player.skaterFullName,
                headshot: headshotUrl,
                team: player.teamAbbrevs,
                position: player.positionCode,
                gamesPlayed: player.gamesPlayed,
                goals: player.goals,
                assists: player.assists,
                points: player.points,
                plusMinus: player.plusMinus,
                penaltyMinutes: String(player.penaltyMinutes),
                shotsOnGoal: player.shots,
                hits: player.hits ?? 0, // Fallback to 0 if undefined
                powerPlayGoals: player.ppGoals,
                shortHandedGoals: player.shGoals,
                blockedShots: player.blockedShots ?? 0, // Switched to blockedShots from blocks for this endpoint
            };
        });

        console.log(`Processing complete. Found ${mappedStats.length} players.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        // Ensure we send a valid JSON response even on error
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

