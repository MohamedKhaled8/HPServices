import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let app: App;

function initAdmin() {
    if (getApps().length > 0) return;

    // Method 1: Full JSON service account (recommended)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            app = initializeApp({
                credential: cert(serviceAccount),
            });
            return;
        } catch (e: any) {
            throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + e.message);
        }
    }

    // Method 2: Individual env vars
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
        throw new Error(
            'Missing env vars. Set FIREBASE_SERVICE_ACCOUNT (full JSON) or all three: ' +
            `FIREBASE_PROJECT_ID=${projectId ? 'OK' : 'MISSING'}, ` +
            `FIREBASE_CLIENT_EMAIL=${clientEmail ? 'OK' : 'MISSING'}, ` +
            `FIREBASE_PRIVATE_KEY=${privateKeyRaw ? 'OK' : 'MISSING'}`
        );
    }

    app = initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKeyRaw.replace(/\\n/gm, '\n'),
        }),
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        initAdmin();

        const { uid, newPassword } = req.body || {};

        if (!uid || !newPassword) {
            return res.status(400).json({
                error: 'Missing uid or newPassword',
            });
        }

        const userRecord = await getAuth().updateUser(uid, {
            password: newPassword,
        });

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            uid: userRecord.uid,
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return res.status(400).json({
            error: error.message || 'Unknown error',
            code: error.code || 'unknown',
        });
    }
}
