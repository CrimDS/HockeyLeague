export default async function handler(req, res) {
    // Vercel uses `req.query` to access URL query parameters like "?id=..."
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'A Game ID is required to fetch stats.' });
    }

    try {
        // This is the specific ESPN API endpoint for a game's summary data
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${id}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch game summary from ESPN: ${response.statusText}`);
        }

        const data = await response.json();

        // --- Data Parsing for Banger Stats ---
        // The following section carefully extracts the specific stats we want from the complex ESPN response.
        
        const boxscore = data.boxscore;
        const awayTeamStats = boxscore.teams[1].statistics;
        const homeTeamStats = boxscore.teams[0].statistics;

        // Helper function to find a specific stat's value
        const getStat = (statsArray, statName) => {
            const stat = statsArray.find(s => s.name === statName);
            // Use displayValue for strings (like PP) and parse integer for numbers
            return stat ? (stat.displayValue.includes('/') ? stat.displayValue : parseInt(stat.displayValue)) : 0;
        };
        
        // Extract all the relevant stats
        const shotsOnGoal = {
            away: getStat(awayTeamStats, 'shotsOnGoal'),
            home: getStat(homeTeamStats, 'shotsOnGoal'),
        };
        const hits = {
            away: getStat(awayTeamStats, 'hits'),
            home: getStat(homeTeamStats, 'hits'),
        };
        const blockedShots = {
            away: getStat(awayTeamStats, 'blockedShots'),
            home: getStat(homeTeamStats, 'blockedShots'),
        };
        const penaltyMinutes = {
            away: getStat(awayTeamStats, 'penaltyMinutes'),
            home: getStat(homeTeamStats, 'penaltyMinutes'),
        };
        const powerPlays = {
            away: getStat(awayTeamStats, 'powerPlay') || '0/0',
            home: getStat(homeTeamStats, 'powerPlay') || '0/0',
        };

        // Get the list of scoring plays
        const scoringPlays = data.scoringPlays?.map(play => {
            return {
                period: play.period.displayValue,
                time: play.clock.displayValue,
                text: play.text, // e.g., "Connor McDavid scores goal"
            };
        }).slice(0, 5); // Limit to the first 5 scoring plays for a clean look

        // Combine all the parsed data into a single, clean object
        const gameStats = {
            shotsOnGoal,
            hits,
            blockedShots,
            penaltyMinutes,
            powerPlays,
            scoringPlays,
        };
        
        // Send the formatted stats back as a successful response
        res.status(200).json(gameStats);

    } catch (error) {
        console.error(`Error fetching stats for game ID ${id}:`, error);
        res.status(500).json({ error: 'An error occurred while fetching game stats.' });
    }
}

