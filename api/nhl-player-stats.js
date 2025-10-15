// api/nhl-player-stats.js

export default async function handler(req, res) {
    // This endpoint fetches detailed player statistics from ESPN's leaders API.
    // It's designed to collect a wide range of stats and consolidate them per player.
    const url = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/leaders";

    try {
        console.log("Fetching player stats from ESPN...");
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`ESPN API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Successfully fetched data, now processing...");

        const playerStats = {}; // Use a map for efficient consolidation { playerId: {stats} }

        if (!data.leaders) {
            throw new Error("Leaders data is missing from the API response.");
        }

        data.leaders.forEach(category => {
            const statName = category.shortDisplayName;
            
            if (!category.leaders || !Array.isArray(category.leaders)) {
                return; // Skip this category if it has no leaders array.
            }

            category.leaders.forEach(playerEntry => {
                try {
                    if (!playerEntry.athlete || !playerEntry.athlete.id) {
                        return; // Skip this entry if it's not a valid player.
                    }

                    const player = playerEntry.athlete;
                    const playerId = player.id;

                    if (!playerStats[playerId]) {
                        playerStats[playerId] = {
                            id: playerId,
                            name: player.displayName,
                            headshot: player.headshot?.href || 'https://placehold.co/100x100/333/FFFFFF?text=??',
                            team: player.team?.abbreviation || 'N/A',
                            position: player.position?.abbreviation || 'N/A',
                            gamesPlayed: 0,
                            goals: 0,
                            assists: 0,
                            points: 0,
                            plusMinus: 0,
                            penaltyMinutes: '0',
                            shotsOnGoal: 0,
                            hits: 0,
                            powerPlayGoals: 0,
                            shortHandedGoals: 0,
                            blockedShots: 0,
                        };
                    }

                    const value = playerEntry.value;

                    // **IMPROVED FIX:** Add a check to ensure value is a number before rounding.
                    if (typeof value !== 'number') return;

                    switch (statName) {
                        case 'GP': playerStats[playerId].gamesPlayed = Math.round(value); break;
                        case 'G': playerStats[playerId].goals = Math.round(value); break;
                        case 'A': playerStats[playerId].assists = Math.round(value); break;
                        case 'PTS': playerStats[playerId].points = Math.round(value); break;
                        case '+/-': playerStats[playerId].plusMinus = Math.round(value); break;
                        case 'PIM': playerStats[playerId].penaltyMinutes = playerEntry.displayValue; break;
                        case 'SOG': playerStats[playerId].shotsOnGoal = Math.round(value); break;
                        case 'HITS': playerStats[playerId].hits = Math.round(value); break;
                        case 'PPG': playerStats[playerId].powerPlayGoals = Math.round(value); break;
                        case 'SHG': playerStats[playerId].shortHandedGoals = Math.round(value); break;
                        case 'BS': playerStats[playerId].blockedShots = Math.round(value); break;
                    }
                } catch (e) {
                    console.warn("Could not process a player entry:", playerEntry, e);
                }
            });
        });
        
        const consolidatedStats = Object.values(playerStats);
        
        consolidatedStats.forEach(p => {
            if (p.points > 0 && p.gamesPlayed === 0) {
                 const gpLeader = data.leaders.find(c => c.shortDisplayName === 'GP')?.leaders.find(l => l.athlete && l.athlete.id === p.id);
                 if (gpLeader) {
                     p.gamesPlayed = Math.round(gpLeader.value);
                 }
            }
        });

        console.log(`Processing complete. Found ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message, error.stack);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

