// api/get-yahoo-matchups.js

// A reusable helper function to get a new access token using the refresh token.
async function getAccessToken(refreshToken) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing required credentials for token refresh.");
    }
    
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to refresh access token. Status: ${response.status}. Body: ${errorBody}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// This is the main API endpoint that will be called from the admin page.
export default async function handler(req, res) {
    const refreshToken = req.cookies.yahoo_refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: "Not authenticated. Please connect your Yahoo account." });
    }

    try {
        const accessToken = await getAccessToken(refreshToken);

        // **NEW**: API call to get the league scoreboard for the current week.
        const leagueKey = '465.l.6058'; // Your specific league key
        const apiUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`;

        const yahooResponse = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!yahooResponse.ok) {
            const errorBody = await yahooResponse.text();
            throw new Error(`Yahoo API request failed. Status: ${yahooResponse.status}. Body: ${errorBody}`);
        }

        const scoreboardData = await yahooResponse.json();

        res.status(200).json(scoreboardData);

    } catch (error) {
        console.error("Error fetching Yahoo scoreboard:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}
