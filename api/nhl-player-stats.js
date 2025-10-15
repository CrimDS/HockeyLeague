// api/nhl-player-stats.js

export default async function handler(req, res) {
    // This endpoint now fetches player statistics directly from the NHL's undocumented API.
    // The structure is similar to ESPN's, providing leaders by category which we will consolidate.
    const url = "https://api-web.nhle.com/v1/skater-stats-leaders/current";

    try {
        console.log("Fetching player stats from NHL API...");
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`NHL API responded with status: ${response.status}`);
            throw new Error(`Failed to fetch player stats. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Successfully fetched data from NHL API, now processing...");

        const playerStats = {}; // Use a map for efficient consolidation { playerId: {stats} }

        // The NHL API response is an object with keys for each stat category (e.g., goals, assists).
        // We will iterate over these categories to build our consolidated player objects.
        const statCategories = [
            'goals', 'assists', 'points', 'plusMinus', 'powerPlayGoals', 
            'shorthandedGoals', 'shots', 'hits', 'blockedShots', 'pim'
        ];

        // We process gamesPlayed separately as it's a core stat for every player.
        const gamesPlayedData = data.gamesPlayed || [];
        gamesPlayedData.forEach(playerEntry => {
            try {
                const playerId = playerEntry.id;
                playerStats[playerId] = {
                    id: playerId,
                    name: `${playerEntry.firstName.default} ${playerEntry.lastName.default}`,
                    headshot: playerEntry.headshot,
                    team: playerEntry.teamAbbrevs,
                    position: playerEntry.positionCode,
                    gamesPlayed: playerEntry.value,
                    goals: 0, assists: 0, points: 0, plusMinus: 0, penaltyMinutes: '0',
                    shotsOnGoal: 0, hits: 0, powerPlayGoals: 0, shortHandedGoals: 0, blockedShots: 0,
                };
            } catch (e) {
                console.warn("Could not process a gamesPlayed entry:", playerEntry, e);
            }
        });


        // Now, iterate through all other stat categories and update the players.
        for (const category of statCategories) {
            if (data[category] && Array.isArray(data[category])) {
                data[category].forEach(playerEntry => {
                    try {
                        const playerId = playerEntry.id;
                        // If a player appears in a stat category but not in gamesPlayed (rare), add them.
                        if (!playerStats[playerId]) {
                             playerStats[playerId] = {
                                id: playerId,
                                name: `${playerEntry.firstName.default} ${playerEntry.lastName.default}`,
                                headshot: playerEntry.headshot,
                                team: playerEntry.teamAbbrevs,
                                position: playerEntry.positionCode,
                                gamesPlayed: playerEntry.gamesPlayed || 0,
                                goals: 0, assists: 0, points: 0, plusMinus: 0, penaltyMinutes: '0',
                                shotsOnGoal: 0, hits: 0, powerPlayGoals: 0, shortHandedGoals: 0, blockedShots: 0,
                            };
                        }

                        const value = playerEntry.value;

                        // Update the specific stat for the player
                        switch (category) {
                            case 'goals': playerStats[playerId].goals = value; break;
                            case 'assists': playerStats[playerId].assists = value; break;
                            case 'points': playerStats[playerId].points = value; break;
                            case 'plusMinus': playerStats[playerId].plusMinus = value; break;
                            case 'powerPlayGoals': playerStats[playerId].powerPlayGoals = value; break;
                            case 'shorthandedGoals': playerStats[playerId].shortHandedGoals = value; break;
                            case 'shots': playerStats[playerId].shotsOnGoal = value; break;
                            case 'hits': playerStats[playerId].hits = value; break;
                            case 'blockedShots': playerStats[playerId].blockedShots = value; break;
                            case 'pim': playerStats[playerId].penaltyMinutes = String(value); break;
                        }
                    } catch (e) {
                         console.warn(`Could not process a player entry in category '${category}':`, playerEntry, e);
                    }
                });
            }
        }
        
        const consolidatedStats = Object.values(playerStats);
        
        console.log(`Processing complete. Found ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

