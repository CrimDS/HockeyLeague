// api/get-yahoo-data.js

// [FINAL, MOST ROBUST VERSION] This version correctly parses the nested 'team_standings' object from the Yahoo API.

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

// A helper to flatten Yahoo's array of single-key objects.
const flattenYahooObjectArray = (arr) => {
    if (!Array.isArray(arr)) return {};
    return arr.reduce((acc, curr) => {
        if (typeof curr === 'object' && curr !== null) {
            Object.assign(acc, curr);
        }
        return acc;
    }, {});
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
            
            const teamData = flattenYahooObjectArray(item.team);
            const name = teamData.name;
            const logo = teamData.team_logos?.[0]?.team_logo?.url;
            
            if (!name) return null;

            // **FIX**: The rank and records are nested inside 'team_standings'. We access this directly and safely.
            const standingsInfo = teamData.team_standings;
            const rank = standingsInfo?.rank || 0;
            const outcomeTotals = standingsInfo?.outcome_totals;
            
            return {
                name: name,
                logo: logo || 'https://placehold.co/48x48/111/fff?text=?',
                wins: outcomeTotals?.wins || 0,
                losses: outcomeTotals?.losses || 0,
                ties: outcomeTotals?.ties || 0,
                rank: rank
            };
        }).filter(Boolean).sort((a,b) => parseInt(a.rank) - parseInt(b.rank));

        // --- Process Matchups ---
        const rawMatchups = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
        if (!rawMatchups) throw new Error("Could not find matchups data in Yahoo's response.");
        
        const matchups = Object.values(rawMatchups).map(item => {
             if (!item.matchup?.['0']?.teams) return null;
            
            const teams = Object.values(item.matchup['0'].teams);
            if (teams.length < 2) return null;

            const team1Data = flattenYahooObjectArray(teams[0].team);
            const team2Data = flattenYahooObjectArray(teams[1].team);

            if(!team1Data.name || !team2Data.name) return null;

            return {
                team1: {
                    name: team1Data.name,
                    logo: team1Data.team_logos?.[0]?.team_logo?.url || '',
                    score: team1Data.team_points?.total || 0
                },
                team2: {
                    name: team2Data.name,
                    logo: team2Data.team_logos?.[0]?.team_logo?.url || '',
                    score: team2Data.team_points?.total || 0
                }
            };
        }).filter(Boolean);

        res.status(200).json({ standings, matchups });

    } catch (error) {
        console.error("Error fetching Yahoo data:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}

