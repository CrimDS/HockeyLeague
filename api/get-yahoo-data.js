// api/get-yahoo-data.js

// [FINAL, MOST ROBUST VERSION] This version uses a multi-layered parsing strategy to handle multiple possible data formats from the Yahoo API.

async function getAccessToken(refreshToken) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    if (!clientId || !clientSecret || !refreshToken) throw new Error("Missing credentials for token refresh.");
    
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
        body: new URLSearchParams({ 'grant_type': 'refresh_token', 'refresh_token': refreshToken })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to refresh access token. Status: ${response.status}. Body: ${errorBody}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// A safer helper function to find a specific key within Yahoo's complex nested arrays.
const findValueByKey = (arr, key) => {
    for (const item of arr) {
        if (Array.isArray(item)) {
            const result = findValueByKey(item, key);
            if (result) return result;
        } else if (typeof item === 'object' && item !== null && item[key]) {
            return item[key];
        }
    }
    return null;
};


export default async function handler(req, res) {
    const refreshToken = req.cookies.yahoo_refresh_token;
    if (!refreshToken) {
        return res.status(401).json({ error: "Not authenticated. Please connect your account in the Admin Panel." });
    }

    try {
        const accessToken = await getAccessToken(refreshToken);
        const leagueKey = '465.l.6058';
        
        const standingsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
        const scoreboardUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`;

        const [standingsResponse, scoreboardResponse] = await Promise.all([
            fetch(standingsUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
            fetch(scoreboardUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        ]);

        if (!standingsResponse.ok) throw new Error("Yahoo API request for standings failed.");
        if (!scoreboardResponse.ok) throw new Error("Yahoo API request for scoreboard failed.");

        const standingsData = await standingsResponse.json();
        const scoreboardData = await scoreboardResponse.json();

        // --- Process Standings ---
        const rawStandings = standingsData?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
        if (!rawStandings) throw new Error("Could not find standings data in Yahoo's response.");

        const standings = Object.values(rawStandings).map(item => {
            if (!item || !item.team) return null;
            
            const teamArray = item.team;
            const name = findValueByKey(teamArray, 'name');
            const logo = findValueByKey(teamArray, 'team_logos')?.[0]?.team_logo?.url;
            const rank = findValueByKey(teamArray, 'rank');
            
            if (!name) return null; // Skip if there's no team name.

            let wins = 0, losses = 0, ties = 0;

            // **FIX**: Implement a two-pronged approach to find the win/loss record.
            // Method 1: Look for the 'outcome_totals' object directly.
            const outcomeTotals = findValueByKey(teamArray, 'outcome_totals');
            if (outcomeTotals) {
                wins = outcomeTotals.wins;
                losses = outcomeTotals.losses;
                ties = outcomeTotals.ties;
            } else {
                // Method 2 (Fallback): If 'outcome_totals' is missing, search for the W-L-T stat string.
                const teamStatsObject = findValueByKey(teamArray, 'team_stats');
                if (teamStatsObject && teamStatsObject.stats) {
                    // Stat ID '9004003' is Yahoo's ID for the "W-L-T" record string.
                    const outcomeStat = teamStatsObject.stats.find(s => s.stat.stat_id === "9004003");
                    if (outcomeStat && typeof outcomeStat.stat.value === 'string') {
                        const parts = outcomeStat.stat.value.split('-');
                        wins = parts[0] || 0;
                        losses = parts[1] || 0;
                        ties = parts[2] || 0;
                    }
                }
            }

            return {
                name: name,
                logo: logo || 'https://placehold.co/48x48/111/fff?text=?',
                wins: wins,
                losses: losses,
                ties: ties,
                rank: rank || 0
            };
        }).filter(Boolean).sort((a,b) => parseInt(a.rank) - parseInt(b.rank));

        // --- Process Matchups (already working, kept for completeness) ---
        const rawMatchups = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
        if (!rawMatchups) throw new Error("Could not find matchups data in Yahoo's response.");
        
        const matchups = Object.values(rawMatchups).map(item => {
             if (!item.matchup?.['0']?.teams) return null;
            const teams = Object.values(item.matchup['0'].teams);
            if (teams.length < 2) return null;
            const team1Array = teams[0].team;
            const team2Array = teams[1].team;
            const team1Name = findValueByKey(team1Array, 'name');
            const team1Logo = findValueByKey(team1Array, 'team_logos')?.[0]?.team_logo?.url;
            const team1Score = findValueByKey(team1Array, 'team_points')?.total;
            const team2Name = findValueByKey(team2Array, 'name');
            const team2Logo = findValueByKey(team2Array, 'team_logos')?.[0]?.team_logo?.url;
            const team2Score = findValueByKey(team2Array, 'team_points')?.total;
            if(!team1Name || !team2Name) return null;
            return {
                team1: { name: team1Name, logo: team1Logo || '', score: team1Score || 0 },
                team2: { name: team2Name, logo: team2Logo || '', score: team2Score || 0 }
            };
        }).filter(Boolean);

        res.status(200).json({ standings, matchups });

    } catch (error) {
        console.error("Error fetching Yahoo data:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}

