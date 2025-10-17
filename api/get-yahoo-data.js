// api/get-yahoo-data.js

// This single endpoint fetches both standings and scoreboard data for the public-facing homepage.

async function getAccessToken(refreshToken) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    if (!clientId || !clientSecret || !refreshToken) throw new Error("Missing credentials for token refresh.");
    
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({ 'grant_type': 'refresh_token', 'refresh_token': refreshToken })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to refresh access token. Status: ${response.status}. Body: ${errorBody}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// Helper function to simplify parsing the complex Yahoo API response
const cleanYahooData = (data) => {
    if (!data) return [];
    // The actual data is always in a numbered object, so we get the first value.
    const collection = Object.values(data)[0];
    // The data is then in an array under a key like 'league' or 'matchup'
    const key = Object.keys(collection).find(k => Array.isArray(collection[k]));
    return key ? collection[key] : [];
};

export default async function handler(req, res) {
    const refreshToken = req.cookies.yahoo_refresh_token;
    if (!refreshToken) {
        return res.status(401).json({ error: "Not authenticated with Yahoo." });
    }

    try {
        const accessToken = await getAccessToken(refreshToken);
        const leagueKey = '465.l.6058';
        
        // Fetch standings and scoreboard data in parallel for efficiency
        const standingsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
        const scoreboardUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`;

        const [standingsResponse, scoreboardResponse] = await Promise.all([
            fetch(standingsUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
            fetch(scoreboardUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        ]);

        if (!standingsResponse.ok || !scoreboardResponse.ok) {
            throw new Error("One or more Yahoo API requests failed.");
        }

        const standingsData = await standingsResponse.json();
        const scoreboardData = await scoreboardResponse.json();

        // --- Process Standings ---
        const rawStandings = cleanYahooData(standingsData.fantasy_content.league[1].standings[0].teams);
        const standings = rawStandings.map(item => {
            const team = item.team[0];
            const teamPoints = item.team[1].team_points;
            const teamStats = item.team[2].team_stats.stats;
            const outcomeTotals = teamStats.find(s => s.stat.stat_id === '9004003').stat.value.split('-');
            
            return {
                team_id: team[0].team_id,
                name: team[2].name,
                logo: team[5].team_logos[0].team_logo.url,
                wins: outcomeTotals[0] || '0',
                losses: outcomeTotals[1] || '0',
                ties: outcomeTotals[2] || '0',
                rank: item.team[15].rank
            };
        }).sort((a,b) => a.rank - b.rank);


        // --- Process Matchups ---
        const rawMatchups = cleanYahooData(scoreboardData.fantasy_content.league[1].scoreboard[0].matchups);
        const matchups = rawMatchups.map(item => {
            const matchup = item.matchup;
            const team1Data = matchup[0].teams[0].team;
            const team2Data = matchup[0].teams[1].team;
            return {
                team1: {
                    name: team1Data[0][2].name,
                    logo: team1Data[0][5].team_logos[0].team_logo.url,
                    score: team1Data[1].team_points.total
                },
                team2: {
                    name: team2Data[0][2].name,
                    logo: team2Data[0][5].team_logos[0].team_logo.url,
                    score: team2Data[1].team_points.total
                }
            };
        });

        res.status(200).json({ standings, matchups });

    } catch (error) {
        console.error("Error fetching Yahoo data:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}
