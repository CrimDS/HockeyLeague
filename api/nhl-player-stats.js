// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    const seasonId = season || '20232024'; 
    
    // **FIX**: We will now fetch from three separate endpoints and merge the data.
    const baseUrl = `https://api.nhle.com/stats/rest/en/skater`;
    const commonParams = `isAggregate=false&isGame=false&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    const summaryUrl = `${baseUrl}/summary?sort=[{"property":"points","direction":"DESC"}]&${commonParams}`;
    const hitsUrl = `${baseUrl}/hits?sort=[{"property":"hits","direction":"DESC"}]&${commonParams}`;
    const blocksUrl = `${baseUrl}/blocks?sort=[{"property":"blocks","direction":"DESC"}]&${commonParams}`;

    try {
        console.log(`Fetching data from multiple NHL endpoints for season ${seasonId}...`);
        
        const [summaryRes, hitsRes, blocksRes] = await Promise.all([
            fetch(summaryUrl),
            fetch(hitsUrl),
            fetch(blocksUrl)
        ]);

        if (!summaryRes.ok || !hitsRes.ok || !blocksRes.ok) {
            console.error(`An API endpoint failed. Statuses: Summary=${summaryRes.status}, Hits=${hitsRes.status}, Blocks=${blocksRes.status}`);
            throw new Error(`One or more NHL API endpoints failed to respond.`);
        }

        const [summaryData, hitsData, blocksData] = await Promise.all([
            summaryRes.json(),
            hitsRes.json(),
            blocksRes.json()
        ]);
        
        if (!summaryData || !Array.isArray(summaryData.data)) {
            console.warn("NHL Summary API did not return the expected data array.");
            res.status(200).json([]);
            return;
        }

        // Use a map for efficient lookups and merging
        const playerStats = new Map();

        // Step 1: Populate the map with base stats from the summary endpoint.
        summaryData.data.forEach(player => {
            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            playerStats.set(player.playerId, {
                id: player.playerId,
                name: player.skaterFullName,
                headshot: headshotUrl,
                team: player.teamAbbrevs || 'N/A',
                position: player.positionCode,
                gamesPlayed: player.gamesPlayed,
                goals: player.goals,
                assists: player.assists,
                points: player.points,
                plusMinus: player.plusMinus,
                penaltyMinutes: String(player.penaltyMinutes),
                shotsOnGoal: player.shots,
                powerPlayGoals: player.ppGoals,
                shortHandedGoals: player.shGoals,
                hits: 0, // Default value
                blockedShots: 0, // Default value
            });
        });

        // Step 2: Merge in the hits data.
        if (hitsData && Array.isArray(hitsData.data)) {
            hitsData.data.forEach(player => {
                if (playerStats.has(player.playerId)) {
                    playerStats.get(player.playerId).hits = player.hits ?? 0;
                }
            });
        }
        
        // Step 3: Merge in the blocked shots data.
        if (blocksData && Array.isArray(blocksData.data)) {
            blocksData.data.forEach(player => {
                if (playerStats.has(player.playerId)) {
                    playerStats.get(player.playerId).blockedShots = player.blocks ?? 0;
                }
            });
        }

        const mergedStats = Array.from(playerStats.values());
        
        console.log(`Processing complete. Found and merged stats for ${mergedStats.length} players.`);
        res.status(200).json(mergedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

