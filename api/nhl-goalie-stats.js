// api/nhl-goalie-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    const seasonId = season || '20232024'; 
    
    // This endpoint fetches data specifically for goalies.
    const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&sort=[{"property":"wins","direction":"DESC"}]&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    try {
        console.log(`Fetching goalie stats from NHL API URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`NHL Goalie API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch goalie stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.data)) {
            console.warn("NHL Goalie API did not return the expected data array.");
            res.status(200).json([]);
            return;
        }

        // Map the goalie data to a consistent format.
        const mappedStats = data.data.map(goalie => {
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (goalie.teamAbbrevs && goalie.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${goalie.teamAbbrevs}/${goalie.playerId}.png`;
            }

            return {
                id: goalie.playerId,
                name: goalie.goalieFullName,
                headshot: headshotUrl,
                team: goalie.teamAbbrevs || 'N/A',
                gamesPlayed: goalie.gamesPlayed,
                wins: goalie.wins,
                losses: goalie.losses,
                otLosses: goalie.otLosses,
                savePercentage: goalie.savePct ? goalie.savePct.toFixed(3) : '.000',
                goalsAgainstAverage: goalie.goalsAgainstAverage ? goalie.goalsAgainstAverage.toFixed(2) : '0.00',
                shutouts: goalie.shutouts,
            };
        });

        console.log(`Processing complete. Found ${mappedStats.length} goalies.`);
        res.status(200).json(mappedStats);

    } catch (error) {
        console.error("Critical error in nhl-goalie-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch goalie statistics.", details: error.message });
    }
}
