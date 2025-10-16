// api/nhl-player-stats.js

// [V15 - Re-implemented & Verified] This uses the optimal hybrid approach.
// It fetches core stats from /summary and enriches them with banger stats from /realtime.
export default async function handler(req, res) {
    // 1. Determine the season to fetch
    const { season } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)

    const currentSeasonId = currentMonth >= 9 
        ? `${currentYear}${currentYear + 1}` 
        : `${currentYear - 1}${currentYear}`;
    
    const seasonId = season || currentSeasonId;

    // 2. Construct URLs. The realtime endpoint uses a simpler query to ensure stability.
    const baseUrl = `https://api.nhle.com/stats/rest/en/skater`;
    
    // Parameters for the main summary endpoint
    const summaryParams = `isAggregate=false&isGame=false&limit=-1&sort=[{"property":"points","direction":"DESC"}]&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;
    const summaryUrl = `${baseUrl}/summary?${summaryParams}`;

    // Parameters for the realtime endpoint are simplified to ensure the API call succeeds.
    const realtimeParams = `isAggregate=false&isGame=false&limit=-1&cayenneExp=seasonId=${seasonId} and gameTypeId=2 and gamesPlayed>=1`;
    const realtimeUrl = `${baseUrl}/realtime?${realtimeParams}`;

    try {
        console.log(`[V15] Fetching summary and realtime data for season ${seasonId}...`);
        
        const [summaryRes, realtimeRes] = await Promise.all([
            fetch(summaryUrl),
            fetch(realtimeUrl)
        ]);

        if (!summaryRes.ok) {
            console.error(`[V15] Summary API failed with status: ${summaryRes.status}`);
            throw new Error(`The main player stats endpoint failed to respond.`);
        }

        const summaryData = await summaryRes.json();
        
        if (!summaryData || !Array.isArray(summaryData.data)) {
            console.warn("[V15] Main summary API did not return valid data. Returning empty.");
            return res.status(200).json([]);
        }

        // 3. Create a lookup map for banger stats from the realtime data
        const realtimeStatsMap = new Map();
        if (realtimeRes.ok) {
            const realtimeData = await realtimeRes.json();
            if (realtimeData && Array.isArray(realtimeData.data)) {
                console.log(`[V15] Successfully fetched ${realtimeData.data.length} records from realtime endpoint.`);
                realtimeData.data.forEach(player => {
                    if (player && player.playerId) {
                        realtimeStatsMap.set(player.playerId, {
                            hits: player.hits ?? 0,
                            blockedShots: player.blockedShots ?? 0,
                            timeOnIce: player.timeOnIcePerGame ?? '0:00',
                        });
                    }
                });
            }
        } else {
            console.warn(`[V15] Realtime API failed with status ${realtimeRes.status}. Banger stats may be missing.`);
        }


        // 4. Build the final list from the summary data, enriching it with realtime stats
        const consolidatedStats = summaryData.data.map(player => {
            if (!player || !player.playerId) return null;

            let headshotUrl = 'https://placehold.co/100x100/111111/FFFFFF?text=?';
            if (player.teamAbbrevs && player.playerId) {
                headshotUrl = `https://assets.nhle.com/mugs/nhl/latest/${player.teamAbbrevs}/${player.playerId}.png`;
            }
            
            const realtimeStats = realtimeStatsMap.get(player.playerId) || { hits: 0, blockedShots: 0, timeOnIce: '0:00' };

            return {
                id: player.playerId,
                name: player.skaterFullName,
                headshot: headshotUrl,
                team: player.teamAbbrevs || 'N/A',
                position: player.positionCode,
                gamesPlayed: player.gamesPlayed ?? 0,
                goals: player.goals ?? 0,
                assists: player.assists ?? 0,
                points: player.points ?? 0,
                plusMinus: player.plusMinus ?? 0,
                penaltyMinutes: String(player.penaltyMinutes ?? 0),
                powerPlayGoals: player.ppGoals ?? 0,
                // Get banger stats from the enriched data
                hits: realtimeStats.hits,
                blockedShots: realtimeStats.blockedShots,
                timeOnIce: realtimeStats.timeOnIce,
            };
        }).filter(Boolean); // Filter out any null entries

        console.log(`[V15] Processing complete. Consolidated stats for ${consolidatedStats.length} players.`);
        res.status(200).json(consolidatedStats);

    } catch (error) {
        console.error("[V15] Critical error in nhl-player-stats function:", error.message);
        res.status(500).json({ error: "Could not fetch player statistics.", details: error.message });
    }
}

