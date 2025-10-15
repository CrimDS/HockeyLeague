// api/nhl-player-stats.js

export default async function handler(req, res) {
    const { season } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)
    // A new NHL season starts in October (month 9)
    const defaultSeasonId = currentMonth >= 9 ? `${currentYear}${currentYear + 1}` : `${currentYear - 1}${currentYear}`;
    const seasonId = season || defaultSeasonId; 
    
    const baseUrl = `https://api.nhle.com/stats/rest/en/skater`;
    const commonParams = `isAggregate=false&isGame=false&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;

    const summaryUrl = `${baseUrl}/summary?sort=[{"property":"points","direction":"DESC"}]&${commonParams}`;
    const hitsUrl = `${baseUrl}/hits?sort=[{"property":"hits","direction":"DESC"}]&${commonParams}`;
    const blocksUrl = `${baseUrl}/blocks?sort=[{"property":"blocks","direction":"DESC"}]&${commonParams}`;

    try {
        console.log(`Fetching summary data for season ${seasonId}...`);
        const summaryRes = await fetch(summaryUrl);
        if (!summaryRes.ok) throw new Error(`Failed to fetch summary stats. Status: ${summaryRes.status}`);
        const summaryData = await summaryRes.json();
        
        if (!summaryData || !Array.isArray(summaryData.data)) {
            console.warn("NHL Summary API did not return the expected data array.");
            return res.status(200).json([]);
        }

        const playerStats = new Map();

        // Step 1: Populate with base stats. This is the only required step.
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
                powerPlayGoals: player.ppGoals,
                // **FIX**: Initialize Hits and Blocked Shots to 0.
                // The summary endpoint doesn't contain these, so they would otherwise be undefined.
                hits: 0,
                blockedShots: 0,
            });
        });

        // Fetch optional stats individually and handle failures gracefully.
        try {
            console.log("Fetching optional hits data...");
            const hitsRes = await fetch(hitsUrl);
            if (hitsRes.ok) {
                const hitsData = await hitsRes.json();
                if (hitsData && Array.isArray(hitsData.data)) {
                    hitsData.data.forEach(player => {
                        if (playerStats.has(player.playerId)) {
                            playerStats.get(player.playerId).hits = player.hits ?? 0;
                        }
                    });
                }
            } else {
                 console.warn(`Hits API failed with status: ${hitsRes.status}`);
            }
        } catch (e) {
            console.warn("Could not fetch or process hits data:", e.message);
        }
        
        try {
            console.log("Fetching optional blocks data...");
            const blocksRes = await fetch(blocksUrl);
            if (blocksRes.ok) {
                const blocksData = await blocksRes.json();
                if (blocksData && Array.isArray(blocksData.data)) {
                     blocksData.data.forEach(player => {
                        if (playerStats.has(player.playerId)) {
                            playerStats.get(player.playerId).blockedShots = player.blocks ?? 0;
                        }
                    });
                }
            } else {
                console.warn(`Blocks API failed with status: ${blocksRes.status}`);
            }
        } catch (e) {
            console.warn("Could not fetch or process blocks data:", e.message);
        }

        const mergedStats = Array.from(playerStats.values());
        
        console.log(`Processing complete. Found and merged stats for ${mergedStats.length} players.`);
        res.status(200).json(mergedStats);

    } catch (error) {
        console.error("Critical error in nhl-player-stats function:", error.name, error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

