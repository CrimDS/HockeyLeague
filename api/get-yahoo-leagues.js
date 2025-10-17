// api/get-yahoo-leagues.js

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
    // 1. Get the refresh token from the secure cookie.
    const refreshToken = req.cookies.yahoo_refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: "Not authenticated. Please connect your Yahoo account." });
    }

    try {
        // 2. Get a fresh access token.
        const accessToken = await getAccessToken(refreshToken);

        // 3. Make the API call to Yahoo to get the user's NHL fantasy leagues.
        const apiUrl = 'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nhl/leagues?format=json';

        const yahooResponse = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!yahooResponse.ok) {
            const errorBody = await yahooResponse.text();
            throw new Error(`Yahoo API request failed. Status: ${yahooResponse.status}. Body: ${errorBody}`);
        }

        const leaguesData = await yahooResponse.json();

        // 4. Send the data back to the admin page.
        res.status(200).json(leaguesData);

    } catch (error) {
        console.error("Error fetching Yahoo leagues:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo.", details: error.message });
    }
}
