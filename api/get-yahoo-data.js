// api/get-yahoo-data.js

// [FINAL VERSION] This version uses robust, defensive parsing to handle inconsistencies in the Yahoo API response.

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

// A safer helper function to find a specific object within Yahoo's complex arrays.
const findObjectInArray = (arr, key) => arr.find(item => item && typeof item === 'object' && item[key]);

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
            if (!item.team) return null;
            
            const teamDetails = findObjectInArray(item.team, 'name');
            const teamLogos = findObjectInArray(item.team, 'team_logos');
            const outcomeTotals = findObjectInArray(item.team, 'outcome_totals')?.outcome_totals;
            const rank = findObjectInArray(item.team, 'rank')?.rank;

            if (!teamDetails || !outcomeTotals) return null;

            return {
                name: teamDetails.name,
                logo: teamLogos?.team_logos?.[0]?.team_logo?.url || 'https://placehold.co/48x48/111/fff?text=?',
                wins: outcomeTotals.wins,
                losses: outcomeTotals.losses,
                ties: outcomeTotals.ties,
                rank: rank || 0
            };
        }).filter(Boolean).sort((a,b) => parseInt(a.rank) - parseInt(b.rank));

        // --- Process Matchups ---
        const rawMatchups = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
        if (!rawMatchups) throw new Error("Could not find matchups data in Yahoo's response.");
        
        const matchups = Object.values(rawMatchups).map(item => {
            if (!item.matchup?.['0']?.teams) return null;
            
            const teams = Object.values(item.matchup['0'].teams);
            if (teams.length < 2) return null;

            const team1Data = teams[0].team;
            const team2Data = teams[1].team;
            
            const team1Details = findObjectInArray(team1Data, 'name');
            const team1Logos = findObjectInArray(team1Data, 'team_logos');
            const team1Points = findObjectInArray(team1Data, 'team_points')?.team_points;
            
            const team2Details = findObjectInArray(team2Data, 'name');
            const team2Logos = findObjectInArray(team2Data, 'team_logos');
            const team2Points = findObjectInArray(team2Data, 'team_points')?.team_points;

            if(!team1Details || !team2Details) return null;

            return {
                team1: {
                    name: team1Details.name,
                    logo: team1Logos?.team_logos?.[0]?.team_logo?.url || '',
                    score: team1Points?.total || 0
                },
                team2: {
                    name: team2Details.name,
                    logo: team2Logos?.team_logos?.[0]?.team_logo?.url || '',
                    score: team2Points?.total || 0
                }
            };
        }).filter(Boolean);

        res.status(200).json({ standings, matchups });

    } catch (error) {
        console.error("Error fetching Yahoo data:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}

