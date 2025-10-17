// api/yahoo-login.js

// This function now acts as a diagnostic tool to help resolve Redirect URI errors.
export default function handler(req, res) {
    const clientId = process.env.YAHOO_CLIENT_ID;
    
    // Vercel provides the production URL in this environment variable.
    const redirectUri = `https://${process.env.VERCEL_URL}/api/yahoo-callback`;

    if (!clientId || !process.env.VERCEL_URL) {
        return res.status(500).send("Server configuration error. Ensure YAHOO_CLIENT_ID and VERCEL_URL are set.");
    }

    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&language=en-us`;

    // Instead of redirecting, display the generated URL for debugging.
    res.status(200).send(`
        <div style="font-family: sans-serif; background: #111; color: #eee; padding: 2rem; line-height: 1.6;">
            <h1 style="color: #FFD700;">Yahoo API Connection Helper</h1>
            <p>This page will help you correctly configure your Yahoo Developer App.</p>
            <hr style="border-color: #333; margin: 1rem 0;">
            <p><strong>Step 1:</strong> Copy the following URL. This is the exact Redirect URI your website is using.</p>
            <div style="background: #222; padding: 1rem; border-radius: 6px; margin: 1rem 0; word-break: break-all; border: 1px solid #444;">
                <code>${redirectUri}</code>
            </div>
            <p><strong>Step 2:</strong> Go to your <a href="https://developer.yahoo.com/apps/" target="_blank" style="color: #FFD700;">Yahoo Developer Apps page</a>, select your application, and paste the copied URL into the list of "Redirect URI(s)" or "Callback Domain(s)".</p>
            <p><strong>Step 3:</strong> After you have saved the changes in your Yahoo App settings, click the link below to attempt to connect again.</p>
            <br>
            <a href="${authUrl}" style="background-color: #DC143C; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Connect to Yahoo</a>
            <hr style="border-color: #333; margin: 2rem 0;">
            <a href="/admin.html" style="color: #888; font-size: 0.9rem;">&larr; Back to Admin Panel</a>
        </div>
    `);
}

