// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    // Default to the most recent full season if none is provided.
    const seasonId = season || '20232024'; 
    
    // **FIX**: Removed the `&limit=1000` parameter from the URL.
    // This should signal to the API to return all available players instead of a limited subset.
    const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"}]&factCayenneExp=gamesPlayed>=1&cayenneExp=seasonId=${seasonId}`;

    try {
        console.log(`Fetching player stats from NEW NHL API URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`New NHL API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // The new API has a different structure. We need to map the fields.
        const mappedStats = data.data.map(player => ({
            id: player.playerId,
            name: player.skaterFullName,
            headshot: player.playerHeadshot,
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
            blockedShots: player.blocks ?? 0, // Fallback to 0 if undefined
        }));

        console.log(`Processing complete. Found ${mappedStats.length} players.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        // Ensure we send a valid JSON response even on error
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

