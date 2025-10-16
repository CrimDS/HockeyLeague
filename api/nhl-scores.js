// api/nhl-scores.js

// This endpoint uses the stable ESPN API and includes robust error handling.
export default async function handler(req, res) {
    const getFormattedDate = (offset = 0) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const today = getFormattedDate();
    const yesterday = getFormattedDate(-1);
    const tomorrow = getFormattedDate(1);

    const dates = [yesterday, today, tomorrow];
    const fetchPromises = dates.map(date => 
        fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`, {
             headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36' }
        })
    );

    try {
        console.log(`[Scoreboard ESPN] Fetching game data for dates: ${dates.join(', ')}`);
        const responses = await Promise.all(fetchPromises);

        const allEvents = await Promise.all(responses.map(async (response, index) => {
            if (!response.ok) {
                console.warn(`[Scoreboard ESPN] API failed for date ${dates[index]} with status: ${response.status}`);
                return { date: dates[index].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), events: [] };
            }
            const data = await response.json();
            return { date: data.day.date, events: data.events || [] };
        }));

        const processedSchedule = allEvents.map(dayData => {
            const games = dayData.events.map(event => {
                try {
                    const competition = event.competitions[0];
                    const status = competition.status;
                    const competitors = competition.competitors;
                    
                    const homeTeamData = competitors.find(c => c.homeAway === 'home');
                    const awayTeamData = competitors.find(c => c.homeAway === 'away');

                    let period = null;
                    let timeRemaining = null;
                    if (status.type.state === 'in') {
                        period = status.period;
                        timeRemaining = status.displayClock;
                    } else if (status.type.completed) {
                        period = 'FINAL';
                    }
                    
                    return {
                        id: event.id,
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
                } catch (e) {
                    console.error("Error processing a single game, skipping:", event, e);
                    return null; // Skip this game if it has malformed data
                }
            }).filter(Boolean); // Filter out any null (skipped) games

            return {
                date: new Date(dayData.date),
                games: games
            };
        });
        
        console.log('[Scoreboard ESPN] Successfully processed all game data.');
        res.status(200).json(processedSchedule);

    } catch (error) {
        console.error("[Scoreboard ESPN] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch scoreboard data.", details: error.message });
    }
}

