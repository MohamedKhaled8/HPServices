import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle newline characters in private key string
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*'); // adjust in production
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { uid, newPassword } = req.body;

        if (!uid || !newPassword) {
            return res.status(400).json({ error: 'Missing uid or newPassword' });
        }

        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase Admin SDK not initialized correctly. Check Environment Variables.' });
        }

        // Update password via Admin SDK
        const userRecord = await admin.auth().updateUser(uid, {
            password: newPassword,
        });

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            uid: userRecord.uid
        });

    } catch (error: any) {
        console.error('Error updating user password:', error);
        return res.status(500).json({
            error: 'Failed to update password',
            details: error.message
        });
    }
}
