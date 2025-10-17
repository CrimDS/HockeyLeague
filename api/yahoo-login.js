// api/yahoo-login.js

// This function constructs the Yahoo login URL and redirects the user.
export default function handler(req, res) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    
    // Determine the redirect URI based on the environment
    // On Vercel, VERCEL_URL will be available. Locally, you might need to set it.
    const redirectUri = `https://${process.env.VERCEL_URL}/api/yahoo-callback`;

    if (!clientId) {
        return res.status(500).send("Yahoo Client ID is not configured on the server.");
    }

    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&language=en-us`;

    // Redirect the user to Yahoo's login page
    res.redirect(302, authUrl);
}
