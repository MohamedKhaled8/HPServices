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
function initFromEnv() {
    const b64 = process.env.AUTOMATION_RSA_PRIVATE_KEY_B64;
    const pemEnv = process.env.AUTOMATION_RSA_PRIVATE_KEY_PEM;
    let pem = null;
    if (b64 && String(b64).trim()) {
        try {
            pem = Buffer.from(String(b64).trim(), 'base64').toString('utf8');
        } catch (_) {
            /* ignore */
        }
    }
    if (!pem && pemEnv) {
        pem = String(pemEnv).replace(/\\n/g, '\n');
    }
    if (!pem || pem.indexOf('PRIVATE') === -1) {
        console.warn('⚠️ تشفير أتمتة: لا يوجد AUTOMATION_RSA_PRIVATE_KEY_* — الحمولة JSON عبر HTTPS فقط.');
        return;
    }
    try {
        privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' });
        publicSpkiPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
        console.log('🔐 تشفير حمولة الأتمتة (RSA-OAEP + AES-256-GCM) مفعّل.');
    } catch (e) {
        console.warn('⚠️ فشل تحميل مفتاح RSA للأتمتة:', e.message);
        privateKey = null;
        publicSpkiPem = null;
    }
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
    if (!isEnabled()) {
        return next();
    }
    if (req.method !== 'POST' || !req.body || typeof req.body !== 'object') {
        return next();
    }
    const b = req.body;
    const isEnvelope =
        b.v === 1 &&
        typeof b.wrappedKey === 'string' &&
        typeof b.iv === 'string' &&
        typeof b.ciphertext === 'string';

    if (!isEnvelope) {
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
        return next();
    } catch (e) {
        console.warn('فك تشفير أتمتة:', e.message);
        return res.status(400).json({ success: false, error: 'فشل فك تشفير الحمولة.' });
    }
}

module.exports = {
    initFromEnv,
    isEnabled,
    getPublicSpkiPem,
    decryptAutomationBodyMiddleware
};
