// api/nhl-scoreboard.js

// This endpoint fetches detailed scoreboard data for yesterday, today, and tomorrow.
export default async function handler(req, res) {
    // Helper to get date strings in YYYY-MM-DD format
    const getFormattedDate = (offset = 0) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date.toISOString().split('T')[0];
    };

    const today = getFormattedDate();
    const yesterday = getFormattedDate(-1);
    const tomorrow = getFormattedDate(1);

    const dates = [yesterday, today, tomorrow];
    const fetchPromises = dates.map(date => 
        fetch(`https://api-web.nhle.com/v1/schedule/${date}`)
    );

    try {
        console.log(`[Scoreboard] Fetching game data for dates: ${dates.join(', ')}`);
        const responses = await Promise.all(fetchPromises);

        const allGameWeeks = await Promise.all(responses.map(async (response, index) => {
            if (!response.ok) {
                console.warn(`[Scoreboard] API failed for date ${dates[index]} with status: ${response.status}`);
                return { date: dates[index], games: [] }; // Return empty for a failed date
            }
            return response.json();
        }));

        // The API returns a `gameWeek` array, even for a single day.
        // We need to process this to create a clean structure.
        const processedSchedule = allGameWeeks.map((weekData, index) => {
            const date = weekData.date || dates[index]; // Use the original date as a key
            const games = weekData.games || [];

            const processedGames = games.map(game => {
                // Safely access nested properties
                const homeTeam = game.homeTeam;
                const awayTeam = game.awayTeam;
                const gameState = game.gameState; // e.g., 'FUT', 'OFF', 'LIVE'
                const gameScheduleState = game.gameScheduleState; // e.g., 'OK', 'POST'
                
                // Determine time/period
                let period = null;
                let timeRemaining = null;
                let startTime = new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

                if (gameState === 'LIVE' || gameState === 'CRIT') {
                    period = game.periodDescriptor?.number;
                    timeRemaining = game.clock?.timeRemaining;
                } else if (gameState === 'OFF' || gameState === 'FINAL') {
                    period = 'FINAL';
                }

                // Determine power play status
                const isPowerPlay = game.powerPlayStatus?.inSituation || false;
                const powerPlayTeam = isPowerPlay ? (game.powerPlayStatus.situationFor === 'home' ? homeTeam.abbrev : awayTeam.abbrev) : null;
                
                // Get broadcasts
                const broadcasts = game.tvBroadcasts?.map(b => b.network).slice(0, 2) || [];

                return {
                    id: game.id,
                    homeTeam: {
                        abbrev: homeTeam?.abbrev || 'N/A',
                        logo: homeTeam?.logo || '',
                        score: game.homeTeam?.score || 0,
                    },
                    awayTeam: {
                        abbrev: awayTeam?.abbrev || 'N/A',
                        logo: awayTeam?.logo || '',
                        score: game.awayTeam?.score || 0,
                    },
                    gameState: gameState,
                    period: period,
                    timeRemaining: timeRemaining,
                    startTime: startTime,
                    isPowerPlay: isPowerPlay,
                    powerPlayTeam: powerPlayTeam,
                    broadcasts: broadcasts,
                };
            });

            return {
                date: new Date(date), // Return a date object for easier formatting
                games: processedGames
            };
        });
        
        console.log('[Scoreboard] Successfully processed all game data.');
        res.status(200).json(processedSchedule);

    } catch (error) {
        console.error("[Scoreboard] Critical error:", error.message);
        res.status(500).json({ error: "Could not fetch scoreboard data.", details: error.message });
    }
}
