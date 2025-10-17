// api/yahoo-login.js

// This function now uses the client-provided URL to build the redirect URI.
export default function handler(req, res) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    const { origin } = req.query; // Get the origin URL from the query parameter

    if (!clientId) {
        return res.status(500).send("Server configuration error: YAHOO_CLIENT_ID is not set.");
    }
    if (!origin) {
        return res.status(400).send("Client origin URL was not provided. Please click the button from the admin page.");
    }

    // **FIX**: Construct the redirectUri using the client-provided origin.
    // This guarantees an exact match.
    const redirectUri = `${origin}/api/yahoo-callback`;
    
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&language=en-us`;

    // Now that we have the correct URI, we can redirect the user immediately.
    res.redirect(302, authUrl);
}

