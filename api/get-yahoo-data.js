// api/get-yahoo-data.js

// [FINAL, ROBUST VERSION] This version uses a much safer parsing method to handle Yahoo's inconsistent API responses.

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

// **NEW, SAFER PARSER**: This helper function converts Yahoo's array of single-key objects into one simple object.
// E.g., [ {name: 'Team A'}, {rank: 1} ] becomes { name: 'Team A', rank: 1 }
const flattenYahooObjectArray = (arr) => {
    if (!Array.isArray(arr)) return {};
    return arr.reduce((acc, curr) => {
        if (typeof curr === 'object' && curr !== null) {
            const key = Object.keys(curr)[0];
            if (key) {
                acc[key] = curr[key];
            }
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

            return {
                name: teamData.name,
                logo: teamData.team_logos?.[0]?.team_logo?.url || 'https://placehold.co/48x48/111/fff?text=?',
                wins: teamData.outcome_totals?.wins || 0,
                losses: teamData.outcome_totals?.losses || 0,
                ties: teamData.outcome_totals?.ties || 0,
                rank: teamData.rank || 0
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

