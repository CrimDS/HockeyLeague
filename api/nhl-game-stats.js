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

        // --- Data Parsing ---
        // The following section carefully extracts the specific stats we want from the complex ESPN response.
        
        const boxscore = data.boxscore;

        // Find Shots on Goal for both teams
        const awayShotsStat = boxscore.teams[1].statistics.find(s => s.name === 'shotsOnGoal');
        const homeShotsStat = boxscore.teams[0].statistics.find(s => s.name === 'shotsOnGoal');
        const shotsOnGoal = {
            away: awayShotsStat ? parseInt(awayShotsStat.displayValue) : 0,
            home: homeShotsStat ? parseInt(homeShotsStat.displayValue) : 0,
        };

        // Find Power Play data
        const awayPPStat = boxscore.teams[1].statistics.find(s => s.name === 'powerPlay');
        const homePPStat = boxscore.teams[0].statistics.find(s => s.name === 'powerPlay');
        const powerPlays = {
            away: awayPPStat ? awayPPStat.displayValue : '0/0',
            home: homePPStat ? homePPStat.displayValue : '0/0',
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
