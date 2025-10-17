// api/yahoo-callback.js

// This function handles the redirect back from Yahoo after the user logs in.
export default function handler(req, res) {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Error during Yahoo authentication: ${error}`);
    }

    if (code) {
        // For now, we just display the code to confirm the login flow is working.
        // In the next step, we will exchange this code for an access token.
        res.status(200).send(`
            <div style="font-family: sans-serif; background: #111; color: #eee; padding: 2rem;">
                <h1>Authentication Successful!</h1>
                <p>We've received a temporary code from Yahoo. The next step is to exchange this for an access token.</p>
                <p style="word-break: break-all;"><strong>Temporary Code:</strong> ${code}</p>
            </div>
        `);
    } else {
        res.status(400).send("No authorization code provided.");
    }
}
