// api/yahoo-callback.js

// This function now securely stores the refresh token in a cookie with a more compatible security policy.
export default async function handler(req, res) {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Error during Yahoo authentication: ${error}`);
    }

    if (!code) {
        return res.status(400).send("No authorization code provided by Yahoo.");
    }
    
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    // Determine the origin from where the request started to build the correct redirect URI
    const clientOrigin = req.headers['x-forwarded-proto'] + '://' + req.headers['host'];
    const redirectUri = `${clientOrigin}/api/yahoo-callback`;

    if (!clientId || !clientSecret) {
        return res.status(500).send("Server configuration error: Yahoo client credentials are not set.");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`
            },
            body: new URLSearchParams({
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirectUri
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to get access token. Status: ${response.status}. Body: ${errorBody}`);
        }

        const tokenData = await response.json();

        // **FIX**: Changed SameSite from 'Strict' to 'Lax'.
        // This is a more compatible setting that ensures the cookie is sent correctly from all pages on your site.
        res.setHeader('Set-Cookie', `yahoo_refresh_token=${tokenData.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);

        // Redirect the user back to the admin panel with a success flag.
        res.redirect(302, '/admin.html?yahoo_connected=true');

    } catch (err) {
        console.error("Error exchanging code for token:", err);
        res.status(500).send(`
            <div style="font-family: sans-serif; background: #111; color: #eee; padding: 2rem; border-left: 5px solid red;">
                <h1>Token Exchange Failed</h1>
                <p>An error occurred while communicating with the Yahoo token endpoint.</p>
                <p style="color: #aaa; font-size: 0.9rem;"><strong>Error:</strong> ${err.message}</p>
            </div>
        `);
    }
}

