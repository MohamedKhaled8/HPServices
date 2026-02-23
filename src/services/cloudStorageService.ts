import { logger } from '../utils/logger';

// ============================================
// Cloud Storage Service - Google Drive Only
// ============================================

export type CloudProvider = 'google-drive';

interface UploadResult {
    url: string;
    provider: CloudProvider;
    fileId?: string;
    fileName: string;
}

/**
 * Get the cloud provider (Always google-drive now)
 */
const getNextProvider = (): CloudProvider => {
    return 'google-drive';
};

/**
 * Upload file to Google Drive
 */
const uploadToGoogleDrive = async (file: File): Promise<UploadResult> => {
    try {
        logger.log('Uploading to Google Drive:', file.name);

        const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
        const refreshToken = import.meta.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error('Google Drive credentials not configured');
        }

        // Step 1: Get access token using refresh token
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
            throw new Error('Failed to get Google Drive access token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Step 2: Upload file to Google Drive
        const metadata = {
            name: file.name,
            mimeType: file.type,
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: form,
            }
        );

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Google Drive upload failed: ${errorData.error?.message || 'Unknown error'}`);
        }

        const uploadData = await uploadResponse.json();

        // Step 3: Make file publicly accessible
        await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone',
            }),
        });

        // Generate direct download link
        const directLink = `https://drive.google.com/uc?export=download&id=${uploadData.id}`;

        logger.log('✅ Uploaded to Google Drive:', uploadData.name);

        return {
            url: directLink,
            provider: 'google-drive',
            fileId: uploadData.id,
            fileName: file.name,
        };
    } catch (error: any) {
        logger.error('Error uploading to Google Drive:', error);
        throw new Error(`فشل رفع الملف على Google Drive: ${error.message}`);
    }
};

/**
 * Upload file to cloud storage (Google Drive only)
 */
export const uploadToCloudStorage = async (file: File): Promise<UploadResult> => {
    logger.log(`📤 Uploading ${file.name} to Google Drive...`);
    return await uploadToGoogleDrive(file);
};

/**
 * Upload multiple files to cloud storage
 */
export const uploadMultipleToCloudStorage = async (
    files: File[],
    onProgress?: (current: number, total: number) => void
): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    let completed = 0;

    for (const file of files) {
        try {
            const result = await uploadToCloudStorage(file);
            results.push(result);
            completed++;
            if (onProgress) onProgress(completed, files.length);
        } catch (error) {
            logger.error(`Failed to upload ${file.name}:`, error);
            throw error;
        }
    }

    return results;
};
