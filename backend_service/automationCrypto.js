'use strict';

const crypto = require('crypto');

let privateKey = null;
let publicSpkiPem = null;

/**
 * يحمّل مفتاح RSA خاص من البيئة (أحد الخيارين):
 * - AUTOMATION_RSA_PRIVATE_KEY_B64: الملف PEM كامل مشفّر base64 (مفضل لـ Hugging Face Secrets)
 * - AUTOMATION_RSA_PRIVATE_KEY_PEM: PEM متعدد الأسطر (استخدم \\n في سطر واحد إن لزم)
 *
 * لتوليد زوج مفاتيح (مرة واحدة على جهازك):
 *   openssl genrsa -out automation_rsa.pem 2048
 * ثم ضع محتوى automation_rsa.pem في السر كـ B64:
 *   [Convert]::ToBase64String([IO.File]::ReadAllBytes("automation_rsa.pem"))   # PowerShell
 */
function stripOuterQuotes(s) {
    const t = String(s).trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1).trim();
    }
    return t;
}

/** إزالة مسافات/أسطر داخل السلسلة base64 (أخطاء لصق من HF أو المحرر) */
function normalizeBase64OneLine(s) {
    return String(s).replace(/\s/g, '');
}

function initFromEnv() {
    const b64Env = process.env.AUTOMATION_RSA_PRIVATE_KEY_B64;
    const pemEnv = process.env.AUTOMATION_RSA_PRIVATE_KEY_PEM;
    let pem = null;
    let source = '';

    if (b64Env && String(b64Env).trim()) {
        const raw = stripOuterQuotes(b64Env);
        // لو لصقت PEM كامل داخل Secret بدل base64 (شائع في واجهة HF)
        if (raw.includes('-----BEGIN') && raw.includes('PRIVATE KEY-----')) {
            pem = raw.replace(/\r\n/g, '\n').trim();
            source = 'AUTOMATION_RSA_PRIVATE_KEY_B64 (PEM pasted)';
        } else {
            try {
                pem = Buffer.from(normalizeBase64OneLine(raw), 'base64').toString('utf8');
                source = 'AUTOMATION_RSA_PRIVATE_KEY_B64 (base64)';
            } catch (_) {
                pem = null;
            }
        }
    }
    if (!pem && pemEnv && String(pemEnv).trim()) {
        pem = String(pemEnv).replace(/\\n/g, '\n');
        source = 'AUTOMATION_RSA_PRIVATE_KEY_PEM';
    }

    if (!pem || pem.indexOf('PRIVATE') === -1) {
        console.warn(
            '⚠️ [automationCrypto] DISABLED — لم يُحمَّل مفتاح خاص صالح. ' +
                'أضف Secret باسم AUTOMATION_RSA_PRIVATE_KEY_B64 (قيمة base64 من secrets/ أو لصق PEM كامل). ' +
                'تحقق: GET /api/automation-health → payloadEncryption يجب أن يكون true.'
        );
        return;
    }
    try {
        privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' });
        publicSpkiPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
        console.log('🔐 [automationCrypto] ENABLED — فك تشغيل RSA-OAEP + AES-GCM | المصدر:', source);
    } catch (e) {
        console.warn('⚠️ [automationCrypto] createPrivateKey فشل:', e.message);
        privateKey = null;
        publicSpkiPem = null;
    }
    console.log('[automationCrypto] isEnabled=', !!privateKey);
}

function isEnabled() {
    return !!privateKey;
}

function getPublicSpkiPem() {
    return publicSpkiPem;
}

function decryptEnvelope(body) {
    const aesKey = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(body.wrappedKey, 'base64')
    );
    if (aesKey.length !== 32) {
        throw new Error('bad_aes_key');
    }
    const iv = Buffer.from(body.iv, 'base64');
    if (iv.length !== 12) {
        throw new Error('bad_iv');
    }
    const buf = Buffer.from(body.ciphertext, 'base64');
    const tagLen = 16;
    if (buf.length <= tagLen) {
        throw new Error('short_cipher');
    }
    const tag = buf.subarray(buf.length - tagLen);
    const enc = buf.subarray(0, buf.length - tagLen);
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
}

/**
 * إذا التشفير مفعّل: يقبل فقط مغلف { v, wrappedKey, iv, ciphertext } ما عدا ALLOW_PLAINTEXT_AUTOMATION=1
 */
function decryptAutomationBodyMiddleware(req, res, next) {
    if (req.method !== 'POST' || !req.body || typeof req.body !== 'object') {
        return next();
    }
    const b = req.body;
    const looksEncrypted =
        b.v === 1 &&
        typeof b.wrappedKey === 'string' &&
        typeof b.iv === 'string' &&
        typeof b.ciphertext === 'string';

    /** واجهة أرسلت حمولة مشفّرة لكن السيرفر بلا مفتاح خاص — لا نمرّر المغلف كأنه JSON عادي */
    if (!isEnabled() && looksEncrypted) {
        console.error(
            '❌ طلب أتمتة مشفر لكن الخادم بلا AUTOMATION_RSA_PRIVATE_KEY_B64 (أو مفتاح غير صالح). ' +
                'أضف نفس المفتاح الخاص المقترن للمفتاح العام في الواجهة في أسرار Hugging Face ثم Rebuild.'
        );
        return res.status(503).json({
            success: false,
            error:
                'خادم الأتمتة غير جاهز لفك التشفير: اضبط Secret باسم AUTOMATION_RSA_PRIVATE_KEY_B64 في Hugging Face (نفس قيمة آخر automation:setup من secrets/) ثم أعد بناء الـ Space.',
            requiresServerPrivateKey: true
        });
    }

    if (!isEnabled()) {
        return next();
    }

    if (!looksEncrypted) {
        if (process.env.ALLOW_PLAINTEXT_AUTOMATION === '1') {
            console.warn('⚠️ قبول طلب أتمتة غير مشفر (ALLOW_PLAINTEXT_AUTOMATION=1)');
            return next();
        }
        return res.status(400).json({
            success: false,
            error: 'خادم الأتمتة يتطلب حمولة مشفرة. حدّث الواجهة أو عيّن ALLOW_PLAINTEXT_AUTOMATION=1 مؤقتًا.',
            requiresEncryption: true
        });
    }

    try {
        req.body = decryptEnvelope(b);
        const keys = Object.keys(req.body || {});
        if (keys.length) {
            console.log('[automationCrypto] decrypted JSON keys:', keys.join(', '));
        }
        return next();
    } catch (e) {
        console.warn('فك تشفير أتمتة:', e.message);
        return res.status(400).json({
            success: false,
            error:
                'فشل فك تشفير الحمولة — غالبًا المفتاح الخاص على HF لا يطابق المفتاح العام في Vercel. شغّل npm run automation:setup وانسخ الخاص والعام معًا ثم Redeploy.'
        });
    }
}

module.exports = {
    initFromEnv,
    isEnabled,
    getPublicSpkiPem,
    decryptAutomationBodyMiddleware
};
