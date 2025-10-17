// api/yahoo-callback.js

// This function now handles exchanging the temporary code for an access token.
export default async function handler(req, res) {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Error during Yahoo authentication: ${error}`);
    }

    if (!code) {
        return res.status(400).send("No authorization code provided by Yahoo.");
    }
    
    // --- Step 2: Exchange the code for an access token ---
    const clientId = process.env.YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET;
    const clientOrigin = req.headers.referer ? new URL(req.headers.referer).origin : `https://${process.env.VERCEL_URL}`;
    const redirectUri = `${clientOrigin}/api/yahoo-callback`;

    if (!clientId || !clientSecret) {
        return res.status(500).send("Server configuration error: Yahoo client credentials are not set.");
    }

    // We need to create a Base64 encoded string of "CLIENT_ID:CLIENT_SECRET" for the Authorization header.
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

        // For now, we display the tokens to confirm success.
        // In a real application, these would be securely stored in a database.
        res.status(200).send(`
            <div style="font-family: sans-serif; background: #111; color: #eee; padding: 2rem; border-left: 5px solid green;">
                <h1>Token Exchange Successful!</h1>
                <p>We have successfully traded the temporary code for permanent access tokens. We can now start making requests to the Yahoo API.</p>
                <div style="background: #222; padding: 1rem; border-radius: 6px; margin: 1rem 0; word-break: break-all;">
                    <p><strong>Access Token:</strong> ${tokenData.access_token}</p>
                    <hr style="border-color: #333; margin: 1rem 0;">
                    <p><strong>Refresh Token:</strong> ${tokenData.refresh_token}</p>
                </div>
                <br>
                <a href="/admin.html" style="color: #FFD700;">Return to Admin Panel</a>
            </div>
        `);

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

