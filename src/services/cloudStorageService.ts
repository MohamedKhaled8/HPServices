import { logger } from '../utils/logger';
import { getGoogleDriveAccessToken, invalidateDriveToken } from './googleDriveService';

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

        // Step 1: Get access token (prefers secure backend endpoint, falls back to direct env)
        const accessToken = await getGoogleDriveAccessToken();

        // Step 2: Upload file to Google Drive
        const metadata = {
            name: file.name,
            mimeType: file.type,
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const uploadController = new AbortController();
        const uploadTimer = setTimeout(() => uploadController.abort(), 45000);
        let uploadResponse: Response;

        try {
            uploadResponse = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: form,
                    signal: uploadController.signal,
                }
            );
        } catch (fetchErr: any) {
            if (fetchErr?.name === 'AbortError' || uploadController.signal.aborted) {
                throw new Error('انتهت مهلة رفع الملف إلى Google Drive (45 ثانية). يرجى التحقق من سرعة الاتصال وإعادة المحاولة');
            }
            throw fetchErr;
        } finally {
            clearTimeout(uploadTimer);
        }

        if (!uploadResponse.ok) {
            if (uploadResponse.status === 401) {
                invalidateDriveToken();
            }
            const errorData = await uploadResponse.json();
            throw new Error(`Google Drive upload failed: ${errorData.error?.message || 'Unknown error'}`);
        }

        const uploadData = await uploadResponse.json();

        // Step 3: Make file publicly accessible
        const permController = new AbortController();
        const permTimer = setTimeout(() => permController.abort(), 15000);
        try {
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
                signal: permController.signal,
            });
        } catch (permErr: any) {
            logger.warn('Google Drive permission update warning:', permErr?.message || permErr);
        } finally {
            clearTimeout(permTimer);
        }

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
        const msg = error?.message || 'خطأ غير معروف';
        if (msg.includes('فشل الاتصال بـ /api/getDriveToken')) {
            throw error;
        }
        throw new Error(`فشل رفع الملف على Google Drive: ${msg}`);
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
