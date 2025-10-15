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
        
        // --- Team Stats Parsing ---
        const boxscore = data.boxscore;
        const awayTeamBoxscore = boxscore.teams[1];
        const homeTeamBoxscore = boxscore.teams[0];

        // Helper function to find a specific stat's value for a team
        const getTeamStat = (statsArray, statName) => {
            const stat = statsArray.find(s => s.name === statName);
            return stat ? (stat.displayValue.includes('/') ? stat.displayValue : parseInt(stat.displayValue)) : 0;
        };
        
        const teamStats = {
            shotsOnGoal: {
                away: getTeamStat(awayTeamBoxscore.statistics, 'shotsOnGoal'),
                home: getTeamStat(homeTeamBoxscore.statistics, 'shotsOnGoal'),
            },
            hits: {
                away: getTeamStat(awayTeamBoxscore.statistics, 'hits'),
                home: getTeamStat(homeTeamBoxscore.statistics, 'hits'),
            },
            blockedShots: {
                away: getTeamStat(awayTeamBoxscore.statistics, 'blockedShots'),
                home: getTeamStat(homeTeamBoxscore.statistics, 'blockedShots'),
            },
            penaltyMinutes: {
                away: getTeamStat(awayTeamBoxscore.statistics, 'penaltyMinutes'),
                home: getTeamStat(homeTeamBoxscore.statistics, 'penaltyMinutes'),
            },
            powerPlays: {
                away: getTeamStat(awayTeamBoxscore.statistics, 'powerPlay') || '0/0',
                home: getTeamStat(homeTeamBoxscore.statistics, 'powerPlay') || '0/0',
            }
        };

        // --- Individual Player Stats Parsing ---
        const parsePlayerStats = (playerData) => {
            const skaterStats = playerData.statistics.find(s => s.name === 'skaters');
            if (!skaterStats || !skaterStats.athletes) return [];

            const statLabels = skaterStats.labels; // e.g., ['G', 'A', 'S', '+/-', 'PIM', 'HITS', 'BS']
            
            const gIndex = statLabels.indexOf('G');
            const aIndex = statLabels.indexOf('A');
            const sogIndex = statLabels.indexOf('S');
            const hitsIndex = statLabels.indexOf('HITS');
            const bsIndex = statLabels.indexOf('BS');
            const pimIndex = statLabels.indexOf('PIM');

            return skaterStats.athletes.map(athlete => {
                if (athlete.stats.length === 0) return null;
                
                const stats = {
                    name: athlete.athlete.displayName,
                    position: athlete.athlete.position.abbreviation,
                    G: gIndex !== -1 ? athlete.stats[gIndex] : '0',
                    A: aIndex !== -1 ? athlete.stats[aIndex] : '0',
                    SOG: sogIndex !== -1 ? athlete.stats[sogIndex] : '0',
                    HITS: hitsIndex !== -1 ? athlete.stats[hitsIndex] : '0',
                    BS: bsIndex !== -1 ? athlete.stats[bsIndex] : '0',
                    PIM: pimIndex !== -1 ? athlete.stats[pimIndex] : '0',
                };

                // Only include players who had at least one recorded stat
                const hasStats = (stats.G !== '0' || stats.A !== '0' || stats.SOG !== '0' || stats.HITS !== '0' || stats.BS !== '0' || stats.PIM !== '0');
                return hasStats ? stats : null;

            }).filter(p => p !== null);
        };

        const awayPlayerData = boxscore.players.find(p => p.team.id === awayTeamBoxscore.team.id);
        const homePlayerData = boxscore.players.find(p => p.team.id === homeTeamBoxscore.team.id);

        const individualPlayerStats = {
            away: awayPlayerData ? parsePlayerStats(awayPlayerData) : [],
            home: homePlayerData ? parsePlayerStats(homePlayerData) : [],
        };

        // --- Scoring Plays Parsing ---
        const scoringPlays = data.scoringPlays?.map(play => ({
            period: play.period.displayValue,
            time: play.clock.displayValue,
            text: play.text,
        })).slice(0, 5);

        // --- Final Combined Object ---
        const gameStats = {
            teamStats,
            individualPlayerStats,
            scoringPlays,
        };
        
        res.status(200).json(gameStats);

    } catch (error) {
        console.error(`Error fetching stats for game ID ${id}:`, error);
        res.status(500).json({ error: 'An error occurred while fetching game stats.' });
    }
}

