// api/nhl-scores.js

// This endpoint uses the stable ESPN API to fetch scoreboard data for the current day.
export default async function handler(req, res) {
    // Helper to get date string in YYYYMMDD format for the ESPN API
  

    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard`;

    try {
        console.log(`[Scoreboard ESPN] Fetching game data for today: ${today}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`ESPN API failed with status: ${response.status}`);
        }
        const data = await response.json();
        
        const games = (data.events || []).map(event => {
            try {
                const competition = event.competitions[0];
                const status = competition.status;
                const competitors = competition.competitors;
                
                const homeTeamData = competitors.find(c => c.homeAway === 'home');
                const awayTeamData = competitors.find(c => c.homeAway === 'away');

                let period = null;
                let timeRemaining = null;
                if (status.type.state === 'in') { // Game is live
                    period = status.period;
                    timeRemaining = status.displayClock;
                } else if (status.type.completed) {
                    period = 'FINAL';
                }

                return {
                    homeTeam: {
                        abbrev: homeTeamData.team.abbreviation,
                        score: homeTeamData.score,
                    },
                    awayTeam: {
                        abbrev: awayTeamData.team.abbreviation,
                        score: awayTeamData.score,
                    },
                    period: period,
                    timeRemaining: timeRemaining,
                    startTime: status.type.shortDetail,
                };
            } catch {
                return null; // Skip any malformed game data
            }
        }).filter(Boolean); // Filter out any null entries

        // We no longer need to group by date, just return the games array
        res.status(200).json({ games });

    } catch (error) {
        console.error("[NHL Scores API] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch scoreboard data." });
    }
}

