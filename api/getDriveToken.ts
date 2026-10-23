import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Secure Google Drive Token Dispenser
 * Keeps GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN securely on the server
 * and only distributes short-lived (1-hour) access tokens to authorized requests.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            return res.status(500).json({
                error: 'Google Drive credentials not configured on server',
            });
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!tokenResponse.ok) {
            const errData = await tokenResponse.json().catch(() => ({}));
            const errMessage = errData.error_description || errData.error || tokenResponse.statusText;
            return res.status(tokenResponse.status).json({
                error: `Failed to refresh token: ${errMessage}`,
            });
        }

        const tokenData = await tokenResponse.json();

        return res.status(200).json({
            accessToken: tokenData.access_token,
            expiresIn: tokenData.expires_in,
        });
    } catch (error: any) {
        console.error('getDriveToken error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error while obtaining access token',
        });
    }
}
