import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

function initAdmin() {
    if (admin.apps.length) return;

    // Method 1: Full JSON service account (recommended)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
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
            'Missing env vars. Set FIREBASE_SERVICE_ACCOUNT (full JSON) or all of: ' +
            `FIREBASE_PROJECT_ID (${projectId ? 'OK' : 'MISSING'}), ` +
            `FIREBASE_CLIENT_EMAIL (${clientEmail ? 'OK' : 'MISSING'}), ` +
            `FIREBASE_PRIVATE_KEY (${privateKeyRaw ? 'OK' : 'MISSING'})`
        );
    }

    const privateKey = privateKeyRaw.replace(/\\n/gm, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
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
        // Initialize admin inside try so errors are caught
        initAdmin();

        const { uid, newPassword } = req.body || {};

        if (!uid || !newPassword) {
            return res.status(400).json({
                error: 'Missing uid or newPassword',
                received: { uid: !!uid, newPassword: !!newPassword }
            });
        }

        const userRecord = await admin.auth().updateUser(uid, {
            password: newPassword,
        });

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            uid: userRecord.uid
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return res.status(400).json({
            error: error.message || 'Unknown error',
            code: error.code || 'unknown'
        });
    }
}
