const express = require('express');
const { chromium } = require('playwright');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
    res.send('🤖 AI Automation Server is Live and Running!');
});

// Initialize Firebase Admin (يجب إضافة ملف المفاتيح لاحقاً)
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json'))
// });
// const db = admin.firestore();

// Constants
const TARGET_URL = 'https://eksc.usc.edu.eg/login';
const PORTAL_LOGIN_URL = 'https://eksc.usc.edu.eg/login';
const PORTAL_REGISTER_URL = 'https://eksc.usc.edu.eg/register';
const PORTAL_FORGET_PASSWORD_URL = 'https://eksc.usc.edu.eg/forget-password';
const NEW_PORTAL_ACCOUNT_PASSWORD = 'StudentPass123!';

// ============================================
// Helper: normalize Arabic text for fuzzy match
// ============================================
function normalizeArabic(text = '') {
    return text
        .toString()
        .trim()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[-–—]/g, ' ')
        .replace(/[^\u0621-\u064A0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** هل نص خيار القائمة يعادل "لم يُختر بعد" (تجنب إيجاب خاطئ لـ «إختر») */
function isSelectUnsetLabel(text) {
    const raw = (text || '').trim();
    if (!raw) return true;
    const t = normalizeArabic(raw);
    if (!t) return true;
    if (t.includes('اختر')) return true;
    if (/^select\b/i.test(raw) || /\bchoose\b/i.test(raw) || /\bpick\b/i.test(raw)) return true;
    return false;
}

/**
 * انتظار جاهزية نموذج fdtc/create (يقلل "Form elements not found" وسباق التحميل).
 */
async function waitForFdtcCreateFormReady(page, { maxMs = 28000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        const ready = await page.evaluate(() => {
            const sels = document.querySelectorAll('select:not([disabled])');
            const ins = document.querySelectorAll(
                'input:not([type="hidden"]):not([type="password"]):not([type="submit"])'
            );
            return sels.length >= 1 && ins.length >= 2;
        }).catch(() => false);
        if (ready) {
            await page.waitForTimeout(200);
            return true;
        }
        await page.waitForTimeout(250);
    }
    console.log('⚠️ waitForFdtcCreateFormReady: مهلة ناعمة — إعادة تحميل fdtc/create مرة واحدة');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => { });
    await page.waitForTimeout(600);
    await page.waitForSelector('select', { state: 'attached', timeout: 12000 }).catch(() => { });
    return false;
}

/**
 * استخراج البريد وكلمة المرور من نص صفحة الاستعادة (Email: / Pass :)
 */
function parseRecoveryCredentialsFromText(text, nationalIDDigits) {
    if (!text) return null;
    let email = null;
    const emailLine = text.match(/Email\s*:\s*(\S+)/i);
    if (emailLine) email = emailLine[1].trim();
    if (!email) {
        const any = text.match(/([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/);
        if (any) email = any[1].trim();
    }
    let password = null;
    const passLine = text.match(/Pass\s*:\s*(\S+)/i) || text.match(/Password\s*:\s*(\S+)/i);
    if (passLine) password = passLine[1].trim();

    if (email && email.includes('@')) {
        return { email, password: password || nationalIDDigits || '' };
    }
    return null;
}

async function clickPortalLoginButton(page, passwordInput) {
    const loginSelectors = [
        'button:has-text("تسجيل الدخول")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("تسجيل")',
        'button:has-text("دخول")',
        'form button',
        'button.btn-primary'
    ];
    for (const selector of loginSelectors) {
        try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await btn.click();
                return true;
            }
        } catch { /* next */ }
    }
    try {
        const textBtn = page.locator('button, input').filter({ hasText: /تسجيل الدخول|تسجيل|دخول|login/i }).first();
        if (await textBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await textBtn.click();
            return true;
        }
    } catch { /* */ }
    try {
        await passwordInput.focus();
        await page.keyboard.press('Enter');
        return true;
    } catch {
        return false;
    }
}

/**
 * محاولة تسجيل دخول واحدة على بوابة eksc؛ تُرجع true عند مغادرة صفحة الدخول بنجاح.
 */
async function submitPortalLogin(page, email, password) {
    await page.goto(PORTAL_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
    await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => { });
    await page.waitForTimeout(350);

    const emailInput = page.locator('input[type="email"], input[type="text"]').first();
    if (!await emailInput.isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log('⚠️ submitPortalLogin: حقل البريد غير ظاهر');
        return false;
    }
    await emailInput.click({ timeout: 2000 }).catch(() => { });
    await emailInput.fill('');
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"]').first();
    if (!await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) return false;
    await passwordInput.fill('');
    await passwordInput.fill(password);

    const clicked = await clickPortalLoginButton(page, passwordInput);
    if (!clicked) return false;

    try {
        await page.waitForURL((u) => {
            const s = typeof u === 'string' ? u : u.toString();
            return s.includes('/fdtc') || s.includes('/dashboard') || s.includes('/home') ||
                (s.includes('eksc.usc.edu.eg') && !s.includes('/login') && !s.includes('/register') && !s.includes('forget-password'));
        }, { timeout: 16000 });
        return true;
    } catch {
        await page.waitForTimeout(1500);
        const url = page.url();
        if (url.includes('/fdtc') || url.includes('/dashboard') || url.includes('/home')) return true;
        if (!url.includes('/login') && !url.includes('forget-password') && url.includes('eksc.usc.edu.eg')) return true;

        const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
        const failHints = ['غير صحيحة', 'غير صحيح', 'خطأ فى', 'خطأ في', 'credentials', 'incorrect', 'invalid', 'does not match', 'these credentials'];
        if (failHints.some((h) => body.includes(h.toLowerCase()))) return false;
        return false;
    }
}

/**
 * استعادة كلمة المرور بالرقم القومي ثم قراءة البريد المعروض (كلمة المرور غالبًا الرقم القومي).
 */
async function runPortalPasswordRecovery(page, nationalIDDigits) {
    const nid = (nationalIDDigits || '').replace(/\D/g, '');
    if (nid.length !== 14) {
        console.log('⚠️ Recovery: رقم قومي غير صالح');
        return null;
    }

    console.log('🔄 فتح صفحة استعادة كلمة المرور...');
    await page.goto(PORTAL_FORGET_PASSWORD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
    await page.waitForTimeout(500);

    let filled = false;
    const candidates = page.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="email"])');
    const n = await candidates.count();
    for (let i = 0; i < n; i++) {
        const inp = candidates.nth(i);
        if (!await inp.isVisible({ timeout: 500 }).catch(() => false)) continue;
        await inp.fill(nid);
        filled = true;
        console.log('✅ تم إدخال الرقم القومي في نموذج الاستعادة');
        break;
    }
    if (!filled) {
        const first = page.locator('input[type="text"], input[type="tel"]').first();
        if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
            await first.fill(nid);
            filled = true;
        }
    }
    if (!filled) {
        console.log('❌ Recovery: لم يُعثر على حقل الرقم القومي');
        return null;
    }

    const recoverBtn = page.locator('button, input[type="submit"]').filter({
        hasText: /إستعادة|استعادة|استرجاع|إرسال|submit/i
    }).first();
    if (await recoverBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await recoverBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }

    await Promise.race([
        page.waitForFunction(
            () => /Email\s*:/i.test(document.body?.innerText || '') ||
                /@[\w.-]+\.[A-Za-z]{2,}/.test(document.body?.innerText || ''),
            { timeout: 8000 }
        ).catch(() => { }),
        page.waitForTimeout(3500)
    ]);
    const body = await page.locator('body').innerText().catch(() => '');
    console.log('📄 Recovery (أول 600 حرف):', body.substring(0, 600));

    const parsed = parseRecoveryCredentialsFromText(body, nid);
    if (parsed) {
        console.log('✅ تم استخراج بيانات من صفحة الاستعادة، البريد:', parsed.email);
    } else {
        console.log('⚠️ لم يُستخرج بريد من صفحة الاستعادة (قد تكون الرسالة مختلفة)');
    }
    return parsed;
}

/**
 * سلسلة ذكية: حساب جديد → كلمة التسجيل | حساب موجود → بريد النظام + الرقم القومي → استعادة → دخول بالبريد المعروض.
 */
async function runSmartPortalLogin(page, data, registrationHadConflict) {
    const emailKnown = (data.email || '').trim();
    const nid = (data.nationalID || '').replace(/\D/g, '');

    async function attempt(label, email, password) {
        console.log(`🔐 محاولة دخول [${label}] بريد=${email}`);
        const ok = await submitPortalLogin(page, email, password);
        if (ok) console.log(`✅ نجح تسجيل الدخول: ${label}`);
        return ok;
    }

    if (registrationHadConflict) {
        if (await attempt('بريد الطالب + الرقم القومي ككلمة مرور', emailKnown, nid)) return;
        if (await attempt('بريد الطالب + كلمة التسجيل الافتراضية', emailKnown, NEW_PORTAL_ACCOUNT_PASSWORD)) return;
        const recovered = await runPortalPasswordRecovery(page, nid);
        if (recovered && recovered.email) {
            const pw = recovered.password || nid;
            if (await attempt('بعد الاستعادة (بريد البوابة)', recovered.email, pw)) return;
        }
    } else {
        if (await attempt('حساب جديد: كلمة التسجيل', emailKnown, NEW_PORTAL_ACCOUNT_PASSWORD)) return;
        if (await attempt('بريد الطالب + الرقم القومي', emailKnown, nid)) return;
        const recovered = await runPortalPasswordRecovery(page, nid);
        if (recovered && recovered.email) {
            const pw = recovered.password || nid;
            if (await attempt('بعد الاستعادة (بريد البوابة)', recovered.email, pw)) return;
        }
    }

    throw new Error('فشل تسجيل الدخول في بوابة التحول الرقمي بعد كل المحاولات (دخول + استعادة). تحقق من البريد والرقم القومي.');
}

function isBadFawryCell(s) {
    const t = (s == null ? '' : String(s)).trim();
    return !t || t === 'undefined' || t === 'null' || t === '-';
}

/**
 * استنتاج كود فوري من صف الجدول أو من كل الخلايا ثم من نص الصفحة (مهم على Linux / Hugging Face).
 */
function extractLikelyFawryCodeFromDtResult(result, bodyText = '') {
    const tryPick = (s) => {
        const t = (s == null ? '' : String(s)).trim();
        if (isBadFawryCell(t)) return '';
        if (/^\d{9,14}$/.test(t)) return t;
        return '';
    };

    let x = tryPick(result.fawryCode);
    if (x) return x;

    if (Array.isArray(result.allData)) {
        for (const cell of result.allData) {
            x = tryPick(cell);
            if (x) return x;
        }
    }

    const rawHtml = typeof result.pageContent === 'string' ? result.pageContent.replace(/<[^>]+>/g, ' ') : '';
    const blob = `${bodyText}\n${result.pageText || ''}\n${rawHtml}`;
    const labelMatch =
        blob.match(/رقم\s*فوري\s*[:\-]?\s*(\d{9,14})/i) ||
        blob.match(/فوري\s*[:\-]?\s*(\d{9,14})/i) ||
        blob.match(/Fawry\s*[:\-]?\s*(\d{9,14})/i);
    if (labelMatch && labelMatch[1]) {
        const n = labelMatch[1].trim();
        if (!/^01\d{8,10}$/.test(n)) return n;
    }
    const nums = blob.match(/\b\d{9,14}\b/g) || [];
    const uniq = [...new Set(nums.map((n) => n.trim()))];
    for (const n of uniq) {
        if (/^01\d{8,10}$/.test(n)) continue;
        if (n.length >= 9 && n.length <= 14) return n;
    }
    return '';
}

/** كود فوري نهائي بعد دمج الجدول + الاحتياط النصي */
function getFinalFawryCodeFromDtResult(result, bodyText = '') {
    let fawryCode = (result.fawryCode || '').toString().trim();
    if ((isBadFawryCell(fawryCode) || fawryCode === 'undefined') && Array.isArray(result.allData) && result.allData[2]) {
        fawryCode = String(result.allData[2]).trim();
    }
    if (isBadFawryCell(fawryCode) || fawryCode === 'undefined') {
        fawryCode = extractLikelyFawryCodeFromDtResult(result, bodyText);
    }
    if (isBadFawryCell(fawryCode) || fawryCode === 'undefined') return '';
    return fawryCode;
}

app.post('/api/digital-transformation/register', async (req, res) => {
    console.log('\n🔔 ========== NEW REQUEST RECEIVED ==========');
    console.log('📥 Request Body:', JSON.stringify(req.body, null, 2));

    const {
        requestId, studentId, email, fullNameArabic,
        fullNameEnglish, phone, examLanguage, nationalID
    } = req.body;

    console.log('📋 Extracted Data:');
    console.log('  - Email:', email);
    console.log('  - Arabic Name:', fullNameArabic);
    console.log('  - English Name:', fullNameEnglish);
    console.log('  - National ID:', nationalID);
    console.log('  - Phone:', phone);
    console.log('  - Exam Language:', examLanguage);
    console.log('🔔 ==========================================\n');

    console.log(`🚀 Starting automation for: ${email}`);

    const automationPayload = {
        email, fullNameArabic, fullNameEnglish, phone, examLanguage, nationalID
    };

    const MAX_FULL_RETRIES = parseInt(process.env.DT_AUTOMATION_RETRIES || '3', 10) || 3;
    const RETRY_GAP_MS = parseInt(process.env.DT_RETRY_GAP_MS || '12000', 10) || 12000;

    try {
        let lastResult = null;
        let lastFawry = '';

        for (let attempt = 1; attempt <= MAX_FULL_RETRIES; attempt++) {
            console.log(`\n♻️ محاولة أتمتة كاملة ${attempt}/${MAX_FULL_RETRIES} (مناسب لسيرفرات بطيئة مثل HF)...\n`);

            try {
                lastResult = await runAutomation(automationPayload);
            } catch (runErr) {
                console.error(`❌ فشلت المحاولة ${attempt}:`, runErr.message);
                if (attempt === MAX_FULL_RETRIES) {
                    throw runErr;
                }
                await new Promise((r) => setTimeout(r, RETRY_GAP_MS));
                continue;
            }

            const bodyHint = (lastResult.pageText || '') + (typeof lastResult.pageContent === 'string' ? lastResult.pageContent : '');
            lastFawry = getFinalFawryCodeFromDtResult(lastResult, bodyHint);

            if (lastFawry) {
                console.log('✅ Automation success (كود فوري):', lastFawry);
                return res.json({ success: true, data: { ...lastResult, fawryCode: lastFawry } });
            }

            console.warn(`⚠️ المحاولة ${attempt}: لم يُستخرج كود فوري — إعادة تشغيل كاملة بعد ${RETRY_GAP_MS / 1000} ث...`);
            lastResult._failedAttempt = attempt;
            if (attempt < MAX_FULL_RETRIES) {
                await new Promise((r) => setTimeout(r, RETRY_GAP_MS));
            }
        }

        console.error('❌ التحول الرقمي: فشل بعد كل المحاولات', JSON.stringify(lastResult || {}).slice(0, 900));
        return res.status(422).json({
            success: false,
            error: `لم يُستخرج كود فوري بعد ${MAX_FULL_RETRIES} محاولات كاملة. السيرفر البعيد قد يكون بطيء جدًا تجاه موقع الجامعة — جرّب ترقية الـ Space أو تشغيل الأتمتة على VPS أقرب لمصر.`,
            data: lastResult
        });

    } catch (error) {
        console.error('❌ Automation failed:', error.message);
        try {
            // Attempt to take screenshot if possible (would require passing browser context)
        } catch (e) { }

        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// NEW: Electronic Payment Automation (USC Payment Portal)
// =====================================================

app.post('/api/electronic-payment/create', async (req, res) => {
    console.log('\n💳 ========== NEW ELECTRONIC PAYMENT REQUEST ==========');
    console.log('📥 Request Body:', JSON.stringify(req.body, null, 2));

    const {
        requestId,
        studentId,
        email,
        fullNameArabic,
        nationalID,
        phone
    } = req.body;

    if (!email || !fullNameArabic || !nationalID || !phone) {
        return res.status(400).json({
            success: false,
            error: 'البيانات غير مكتملة. يرجى التأكد من (الاسم، البريد الإلكتروني، الرقم القومي، الموبايل).'
        });
    }

    try {
        const result = await runElectronicPaymentAutomation({
            email,
            fullNameArabic,
            nationalID,
            phone
        });

        console.log('✅ Electronic payment automation success:', result);

        const orderNumber = (result.orderNumber || '').toString().trim();
        if (!orderNumber) {
            console.error('[EP] ❌ لم يُستخرج رقم الطلب من صفحة فوري');
            return res.status(422).json({
                success: false,
                error: 'لم يُستخرج رقم الطلب من بوابة الدفع. راجع سجلات السيرفر (Playwright على Linux يحتاج: npx playwright install --with-deps) أو أعد المحاولة.',
                data: {
                    studentId: studentId || '',
                    requestId: requestId || '',
                    rawText: (result.rawText || '').slice(0, 2500)
                }
            });
        }

        // نرجع البيانات للـ Frontend ليحفظها في Firestore
        res.json({
            success: true,
            data: {
                studentId: studentId || '',
                requestId: requestId || '',
                name: fullNameArabic,
                email: email,
                nationalID: nationalID,
                mobile: phone,
                orderNumber,
                serviceType: result.serviceType || 'دبلوم (2025 - 2026)',
                entity: result.entity || 'كلية التربية',
                status: result.status || 'NEW',
                rawText: result.rawText || ''
            }
        });
    } catch (error) {
        console.error('❌ Electronic payment automation failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'فشل في أتمتة الدفع الإلكتروني'
        });
    }
});

async function runAutomation(data) {
    const browser = await chromium.launch({
        headless: true, // Changed to true for production
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        viewport: null, // Let the window size dictate the viewport
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const slowMs = parseInt(process.env.PLAYWRIGHT_SLOW_MS || '90000', 10) || 90000;
    page.setDefaultTimeout(slowMs);
    page.setDefaultNavigationTimeout(slowMs);

    try {
        // 1. Navigate directly to registration page
        console.log('🌍 Step 1: Navigating to registration page...');
        await page.goto(PORTAL_REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('✅ Page loaded, URL:', page.url());
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => { });
        await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => { });
        await page.waitForTimeout(500);

        console.log('📝 Step 2: Attempting registration...');
        let needsLogin = false;
        let registrationAttempted = true;

        // Wait for form to be visible
        await page.waitForSelector('input', { timeout: 10000 }).catch(() => {
            console.log('⚠️ No inputs found on registration page');
        });

        // Get all non-password inputs
        const allInputs = await page.locator('input:not([type="password"])').all();
        console.log(`🔍 Found ${allInputs.length} input fields`);

        // Track what we've filled
        let filledArabicName = false;
        let filledEnglishName = false;

        // Smart fill
        for (let i = 0; i < allInputs.length; i++) {
            const input = allInputs[i];

            try {
                const type = await input.getAttribute('type') || '';
                const name = (await input.getAttribute('name') || '').toLowerCase();
                const placeholder = (await input.getAttribute('placeholder') || '');
                const placeholderLower = placeholder.toLowerCase();

                let valueToFill = null;
                let fieldLabel = '';

                // Email (highest priority - most specific)
                if (type === 'email' || name.includes('email') || placeholderLower.includes('email') || placeholderLower.includes('بريد')) {
                    valueToFill = data.email;
                    fieldLabel = 'Email';
                }
                // Phone
                else if (type === 'tel' || name.includes('phone') || name.includes('mobile') || name.includes('tel') ||
                    placeholderLower.includes('هاتف') || placeholderLower.includes('محمول') || placeholderLower.includes('جوال') || placeholderLower.includes('موبايل')) {
                    valueToFill = data.phone;
                    fieldLabel = 'Phone';
                }
                // National ID
                else if (name.includes('national') || name.includes('nid') ||
                    placeholderLower.includes('قومي') || placeholderLower.includes('هوية') || placeholder.includes('رقم قومي')) {
                    valueToFill = data.nationalID;
                    fieldLabel = 'National ID';
                }
                // Name fields - be VERY careful here
                else if (name.includes('name') || placeholderLower.includes('اسم') || placeholderLower.includes('name')) {
                    // Strategy: Look at the EXACT placeholder text
                    const hasArabicKeyword = placeholder.includes('العربية') || placeholder.includes('عربي') || placeholder.includes('عربى');
                    const hasEnglishKeyword = placeholder.includes('الإنجليزية') || placeholder.includes('انجليزي') || placeholder.includes('إنجليزي') || placeholder.includes('English') || placeholder.includes('english');

                    if (hasArabicKeyword && !filledArabicName) {
                        valueToFill = data.fullNameArabic;
                        fieldLabel = 'Arabic Name';
                        filledArabicName = true;
                    }
                    else if (hasEnglishKeyword && !filledEnglishName) {
                        valueToFill = data.fullNameEnglish;
                        fieldLabel = 'English Name';
                        filledEnglishName = true;
                    }
                    else if (!filledArabicName) {
                        valueToFill = data.fullNameArabic;
                        fieldLabel = 'Arabic Name (first field)';
                        filledArabicName = true;
                    }
                    else if (!filledEnglishName) {
                        valueToFill = data.fullNameEnglish;
                        fieldLabel = 'English Name (second field)';
                        filledEnglishName = true;
                    }
                }

                if (valueToFill) {
                    await input.fill(valueToFill);
                    console.log(`✅ ${fieldLabel}: "${valueToFill}"`);
                }

            } catch (e) {
                console.log(`❌ Field ${i} error:`, e.message);
            }
        }

        // Fill ALL password fields
        console.log('🔐 Filling password fields...');
        const password = 'StudentPass123!';
        const passInputs = await page.locator('input[type="password"]').all();
        for (let i = 0; i < passInputs.length; i++) {
            try {
                await passInputs[i].fill(password);
            } catch (e) {
                console.log(`❌ Password ${i} error:`, e.message);
            }
        }

        // Submit registration form
        console.log('📤 Step 3: Submitting registration form...');
        let submitted = false;

        // Try multiple methods to find and click submit button
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("تسجيل")',
            'button:has-text("حفظ")',
            'button:has-text("إرسال")',
            'form button',
            'button.submit',
            'button.btn-primary'
        ];

        for (const selector of submitSelectors) {
            try {
                const btn = page.locator(selector).first();
                const isVisible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
                if (isVisible) {
                    console.log(`✅ Found submit button with selector: ${selector}`);
                    await btn.click();
                    submitted = true;
                    console.log('✅ Clicked submit button');
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        // If still not submitted, try text-based search
        if (!submitted) {
            try {
                const textBtn = page.locator('button, input').filter({ hasText: /تسجيل|حفظ|إرسال|submit/i }).first();
                const isVisible = await textBtn.isVisible({ timeout: 2000 }).catch(() => false);
                if (isVisible) {
                    await textBtn.click();
                    submitted = true;
                    console.log('✅ Clicked submit button (text-based)');
                }
            } catch (e) {
                console.log('⚠️ Text-based button search failed');
            }
        }

        // Last resort: Press Enter
        if (!submitted) {
            console.log('⚠️ Submit button not found, trying Enter key...');
            try {
                // Focus on last input field first
                const lastInput = page.locator('input').last();
                if (await lastInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await lastInput.focus();
                }
                await page.keyboard.press('Enter');
                submitted = true;
                console.log('✅ Pressed Enter to submit');
            } catch (e) {
                console.log('❌ Error pressing Enter:', e.message);
            }
        }

        if (!submitted) {
            console.log('⚠️ Could not submit registration form - will check result anyway');
        }

        // Wait for response and check for error messages
        console.log('⏳ Step 4: Waiting for registration response...');

        await Promise.race([
            page.waitForURL((u) => !String(u).includes('/register'), { timeout: 7000 }).catch(() => { }),
            page.waitForTimeout(1600)
        ]);

        // Check multiple times for error messages (they might appear with delay)
        let hasError = false;
        let checkAttempts = 0;
        const maxChecks = 3;

        while (checkAttempts < maxChecks && !hasError) {
            checkAttempts++;
            console.log(`🔍 Checking for errors (attempt ${checkAttempts}/${maxChecks})...`);

            // Get current page state
            const currentURL = page.url();
            const pageText = await page.locator('body').innerText().catch(() => '');
            const pageHTML = await page.content().catch(() => '');

            // Check for specific error messages in text
            const errorMessages = [
                'مُستخدم من قبل',
                'مستخدم من قبل',
                'مستخدمة من قبل',
                'البريد الالكتروني مُستخدم',
                'البريد الإلكتروني مُستخدم',
                'الرقم القومي مُستخدم',
                'قيمة الحقل',
                'قيمة الحقل الرقم القومى مُستخدم',
                'قيمة الحقل البريد الالكتروني مُستخدم',
                'already in use',
                'already exists',
                'مستخدم',
                'موجود'
            ];

            hasError = errorMessages.some(msg =>
                pageText.includes(msg) || pageHTML.includes(msg)
            );

            // Also check for error elements in DOM
            if (!hasError) {
                const errorElements = await page.locator('.error, .alert, [class*="error"], [class*="alert"], [class*="danger"], .text-danger, .text-error').count();
                if (errorElements > 0) {
                    const errorText = await page.locator('.error, .alert, [class*="error"], [class*="alert"], [class*="danger"], .text-danger, .text-error').first().innerText().catch(() => '');
                    hasError = errorMessages.some(msg => errorText.includes(msg));
                    if (hasError) {
                        console.log('✅ Found error in error elements:', errorText.substring(0, 100));
                    }
                }
            }

            // Check if still on registration page (indicates failure)
            const passwordInputsCount = await page.locator('input[type="password"]').count();
            const stillOnRegisterPage = currentURL.includes('/register') && passwordInputsCount >= 2;

            if (hasError || (stillOnRegisterPage && checkAttempts === maxChecks)) {
                break;
            }

            // Wait a bit before next check
            if (checkAttempts < maxChecks) {
                await page.waitForTimeout(1200);
            }
        }

        const currentURL = page.url();
        const passwordInputsCount = await page.locator('input[type="password"]').count();
        const stillOnRegisterPage = currentURL.includes('/register') && passwordInputsCount >= 2;

        console.log('🔍 Step 4 Result:');
        console.log('  - Current URL:', currentURL);
        console.log('  - Has error:', hasError);
        console.log('  - Still on register page:', stillOnRegisterPage);
        console.log('  - Password inputs count:', passwordInputsCount);

        const registrationHadConflict = hasError || stillOnRegisterPage;

        // If error found or still on register page → نفترض حسابًا موجودًا على البوابة
        if (hasError || stillOnRegisterPage) {
            console.log('⚠️ Registration failed - Field value already in use (or still on register)');
            console.log('🔄 Step 5: سيتم تسجيل الدخول بسلسلة ذكية (بريد/رقم قومي → استعادة إن لزم)...');
            needsLogin = true;
        } else {
            // Check if we successfully registered (URL changed to login or dashboard)
            if (currentURL.includes('/login') || currentURL.includes('/dashboard') || currentURL.includes('/home')) {
                console.log('✅ Registration successful, proceeding to login...');
                needsLogin = true;
            } else {
                // If URL changed but not to login, might be already logged in
                console.log('ℹ️ URL changed, checking if login is needed...');
                const hasLoginForm = await page.locator('input[type="email"]').isVisible({ timeout: 2000 }).catch(() => false);
                if (hasLoginForm) {
                    console.log('Login form found, needs login');
                    needsLogin = true;
                } else {
                    // Might be already logged in, skip login
                    console.log('✅ Already logged in, skipping login step');
                }
            }
        }

        // 2. Login — سلسلة ذكية (حساب جديد / قديم + استعادة)
        if (needsLogin) {
            console.log('🔐 Step 6: تسجيل الدخول (ذكي)...');
            await runSmartPortalLogin(page, data, registrationHadConflict);
            console.log('✅ Step 6 انتهى، URL:', page.url());
        } else {
            console.log('ℹ️ Login not needed, already logged in');
        }

        // 3. Navigate directly to registration form
        console.log('📚 Step 7: Navigating to form page (fdtc/create)...');
        await page.goto('https://eksc.usc.edu.eg/fdtc/create', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ Form page loaded, URL:', page.url());
        console.log('⏳ Waiting for form elements (stable)...');
        const formReady = await waitForFdtcCreateFormReady(page);
        if (!formReady) {
            console.log('⚠️ النموذج قد لا يكون كاملًا بعد إعادة التحميل — المتابعة مع محاولة التعبئة');
        }

        // 4. Check if fields are already filled (مسجلين قبل كده)
        console.log('🔍 Step 8: Checking if form fields are already filled...');
        let fieldsAlreadyFilled = false;

        try {
            // Check phone field
            const phoneInput = page.locator('input[placeholder*="تليفون"], input[placeholder*="whatsapp"], input[placeholder*="WhatsApp"], input[type="tel"]').first();
            if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                const phoneValue = await phoneInput.inputValue().catch(() => '');
                if (phoneValue && phoneValue.trim() !== '') {
                    console.log('⚠️ Phone field is already filled:', phoneValue);
                    fieldsAlreadyFilled = true;
                }
            }

            // Check dropdowns (selects)
            const selects = await page.locator('select').all();
            for (const select of selects) {
                const selectedValue = await select.evaluate(el => {
                    const selectedOption = el.options[el.selectedIndex];
                    return selectedOption ? selectedOption.text.trim() : '';
                });
                if (selectedValue && !isSelectUnsetLabel(selectedValue)) {
                    console.log(`⚠️ Select field is already filled: ${selectedValue}`);
                    fieldsAlreadyFilled = true;
                    break;
                }
            }
        } catch (e) {
            console.log('⚠️ Error checking filled fields:', e.message);
        }

        // If fields are already filled, create new registration
        if (fieldsAlreadyFilled) {
            console.log('📝 Fields are already filled! Creating new registration...');

            // Try to find and click "حجز جديد" or "New Booking" button
            try {
                const newBookingBtn = page.locator('button, a').filter({ hasText: /حجز جديد|New Booking|تسجيل جديد|إضافة جديد/ }).first();
                if (await newBookingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await newBookingBtn.click();
                    console.log('✅ Clicked "حجز جديد" button');
                    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
                    await page.waitForTimeout(1000);
                } else {
                    // Alternative: Navigate away and back to reset form
                    console.log('⚠️ "حجز جديد" button not found, navigating to reset form...');
                    await page.goto('https://eksc.usc.edu.eg/fdtc', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
                    await page.waitForTimeout(1000);
                    await page.goto('https://eksc.usc.edu.eg/fdtc/create', { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await waitForFdtcCreateFormReady(page, { maxMs: 22000 });
                }
            } catch (e) {
                console.log('⚠️ Error creating new registration, trying to clear and refill...', e.message);
                // Fallback: Try to clear fields manually
                try {
                    const allInputs = await page.locator('input:not([type="password"])').all();
                    for (const input of allInputs) {
                        await input.clear().catch(() => { });
                    }
                    // Reset selects
                    const allSelects = await page.locator('select').all();
                    for (const select of allSelects) {
                        await select.selectOption({ index: 0 }).catch(() => { });
                    }
                    await page.waitForTimeout(500);
                } catch (clearError) {
                    console.log('⚠️ Could not clear fields:', clearError.message);
                }
            }
        }

        // 5. Fill Registration Form - ULTRA FAST
        console.log('📝 Step 9: Filling registration form quickly...');

        // Wait for all form elements to be ready
        await page.waitForSelector('input, select', { timeout: 5000 }).catch(() => { });
        await page.waitForTimeout(500); // Small wait for form to be interactive

        // Fill inputs in parallel - IMMEDIATELY without waiting for visibility checks
        const fillPromises = [];

        // Fill phone/whatsapp field - MOVED TO AFTER SELECTS
        // const phoneSelectors = ...

        // Fill Arabic name - FAST
        const arabicSelectors = [
            'input[name="Name_Ar"]',
            'input[name="name_ar"]',
            'input[placeholder*="العربية"]',
            'input[placeholder*="عربي"]',
            'input[name*="arabic"]',
            'input[name*="ar_name"]'
        ];

        for (const selector of arabicSelectors) {
            try {
                const arabicNameInput = page.locator(selector).first();
                const isVisible = await arabicNameInput.isVisible({ timeout: 1000 }).catch(() => false);
                if (isVisible) {
                    fillPromises.push(
                        arabicNameInput.clear({ timeout: 1000 }).catch(() => { })
                            .then(() => arabicNameInput.fill(data.fullNameArabic, { timeout: 1000 }))
                            .then(() => console.log('✅ Filled Arabic name'))
                    );
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Fill English name - FAST
        const englishSelectors = [
            'input[name="Name_En"]',
            'input[name="name_en"]',
            'input[placeholder*="الإنجليزية"]',
            'input[placeholder*="إنجليزي"]',
            'input[placeholder*="English"]',
            'input[name*="english"]',
            'input[name*="en_name"]'
        ];

        for (const selector of englishSelectors) {
            try {
                const englishNameInput = page.locator(selector).first();
                const isVisible = await englishNameInput.isVisible({ timeout: 1000 }).catch(() => false);
                if (isVisible) {
                    fillPromises.push(
                        englishNameInput.clear({ timeout: 1000 }).catch(() => { })
                            .then(() => englishNameInput.fill(data.fullNameEnglish, { timeout: 1000 }))
                            .then(() => console.log('✅ Filled English name'))
                    );
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Execute all input fills in parallel
        await Promise.all(fillPromises);
        await page.waitForTimeout(300); // Small wait for inputs to settle

        // ------------------------------------------------------------------
        // SIMPLE STRATEGY: Fill ALL visible inputs and selects in order
        // ------------------------------------------------------------------
        console.log('📝 Step 10: Simple Sequential Filling (No Label Matching)...');
        await page.waitForTimeout(400);

        // 1. Fill ALL text/tel inputs (Names + Phone)
        console.log('📝 Filling all text inputs...');
        const formInputs = await page.locator('input:not([type="password"]):not([type="hidden"]):not([disabled])').all();
        console.log(`Found ${formInputs.length} fillable inputs`);


        for (let i = 0; i < formInputs.length; i++) {
            try {
                const input = formInputs[i];
                const type = await input.getAttribute('type');
                const placeholder = await input.getAttribute('placeholder') || '';
                const name = await input.getAttribute('name') || '';
                const currentValue = await input.inputValue();

                console.log(`Input ${i}: type="${type}", placeholder="${placeholder}", name="${name}"`);

                // Skip if already filled
                if (currentValue && currentValue.trim() !== '') {
                    console.log(`  ↳ Already filled: ${currentValue.substring(0, 20)}`);
                    continue;
                }

                // Determine what to fill - BE VERY STRICT
                let valueToFill = '';
                let fieldType = '';

                // PHONE - Must have explicit indicators
                if (type === 'tel' ||
                    placeholder.toLowerCase().includes('تليفون') ||
                    placeholder.toLowerCase().includes('whatsapp') ||
                    placeholder.toLowerCase().includes('هاتف') ||
                    placeholder.toLowerCase().includes('phone') ||
                    placeholder.toLowerCase().includes('mobile') ||
                    name.toLowerCase().includes('phone') ||
                    name.toLowerCase().includes('mobile') ||
                    name.toLowerCase().includes('tel') ||
                    /^mobile$/i.test(name.trim())) {
                    valueToFill = data.phone;
                    fieldType = 'PHONE';
                }
                // ARABIC NAME - Must have explicit indicators
                else if (placeholder.includes('عربي') ||
                    placeholder.includes('العربية') ||
                    placeholder.includes('عربى') ||
                    name.toLowerCase().includes('arabic') ||
                    name.toLowerCase().includes('ar_name') ||
                    /^name_ar$/i.test(name.trim())) {
                    valueToFill = data.fullNameArabic;
                    fieldType = 'ARABIC NAME';
                }
                // ENGLISH NAME - Must have explicit indicators
                else if (placeholder.includes('إنجليزي') ||
                    placeholder.includes('الإنجليزية') ||
                    placeholder.includes('انجليزي') ||
                    placeholder.toLowerCase().includes('english') ||
                    name.toLowerCase().includes('english') ||
                    name.toLowerCase().includes('en_name') ||
                    /^name_en$/i.test(name.trim())) {
                    valueToFill = data.fullNameEnglish;
                    fieldType = 'ENGLISH NAME';
                }
                // If we can't identify it clearly, SKIP IT
                else {
                    console.log(`  ↳ SKIPPED (unclear field type)`);
                    continue;
                }

                if (valueToFill) {
                    await input.scrollIntoViewIfNeeded();
                    await input.fill(valueToFill, { force: true });
                    console.log(`  ✅ Filled ${fieldType}: ${valueToFill.substring(0, 20)}...`);
                }
            } catch (e) {
                console.log(`Input ${i} error:`, e.message);
            }
        }

        await page.waitForTimeout(500);

        // 2. Fill ALL selects (Training Type, College, University)
        console.log('📋 Filling all select dropdowns...');
        const allSelects = await page.locator('select:not([disabled])').all();
        console.log(`Found ${allSelects.length} select dropdowns`);

        for (let i = 0; i < allSelects.length; i++) {
            try {
                const select = allSelects[i];
                const options = await select.locator('option').allInnerTexts();
                const optionsStr = options.join(' ').toLowerCase();

                console.log(`Select ${i}: ${options.length} options`);

                // Check what this select contains
                let selectedSomething = false;

                // Training Type (Check for keywords like 'exam', 'training', 'arabic', 'english')
                // FIXED: Don't require BOTH arabic and english. Just 'test' or 'training' keywords are enough.
                if (optionsStr.includes('اختبار') || optionsStr.includes('تدريب') || (optionsStr.includes('عربي') && optionsStr.includes('انجليزي'))) {
                    console.log(`Select ${i}: Detected TRAINING TYPE (Keywords found)`);
                    console.log(`  Target from DB: "${data.examLanguage}"`);

                    // Helper to normalize Arabic & cleaning
                    const normalizeText = (text) => {
                        return text
                            .toLowerCase()
                            .replace(/[()]/g, '')     // Remove brackets
                            .replace(/[أإآ]/g, 'ا')    // Normalize Alef
                            .replace(/[ة]/g, 'ه')     // Normalize Taa Marbouta
                            .replace(/[ى]/g, 'ي')     // Normalize Yaa
                            .replace(/\s+/g, ' ')     // Normalize spaces
                            .trim();
                    };

                    const targetNorm = normalizeText(data.examLanguage);
                    // Split target into words, handle typo "بالغة" -> ignore small words
                    const targetWords = targetNorm.split(' ').filter(w => w.length > 3 || w === 'فقط');

                    console.log(`  Target Normalized: "${targetNorm}"`);
                    console.log(`  Target Keywords: ${JSON.stringify(targetWords)}`);

                    let bestMatch = null;
                    let bestScore = -1;

                    for (const opt of options) {
                        const optNorm = normalizeText(opt);
                        if (optNorm.includes('اختر') || optNorm === 'select') continue;

                        let score = 0;

                        // 1. Exact match bonus (after normalization) mechanism
                        if (optNorm === targetNorm) score += 100;

                        // 2. Keyword overlap
                        for (const word of targetWords) {
                            if (optNorm.includes(word)) score += 10;
                        }

                        // 3. Language specific bonus
                        // 3. Language specific bonus (Use roots to handle ه vs ي endings)
                        // English indicators
                        const isTargetEnglish = targetNorm.includes('english') || targetNorm.includes('انجليز');
                        const isOptEnglish = optNorm.includes('english') || optNorm.includes('انجليز');

                        if (isTargetEnglish && isOptEnglish) score += 20;

                        // Arabic indicators
                        const isTargetArabic = targetNorm.includes('arabic') || targetNorm.includes('عرب');
                        const isOptArabic = optNorm.includes('arabic') || optNorm.includes('عرب');

                        if (isTargetArabic && isOptArabic) score += 20;

                        // 4. Test Only specific bonus
                        if (targetNorm.includes('اختبار') && optNorm.includes('اختبار')) score += 5;
                        if (targetNorm.includes('test') && optNorm.includes('test')) score += 5;

                        console.log(`  > Option: "${opt}" (Norm: "${optNorm}") -> Score: ${score}`);

                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = opt;
                        }
                    }

                    console.log(`  🏆 Winner: "${bestMatch}" (Score: ${bestScore})`);

                    if (bestMatch && bestScore > 0) {
                        await select.selectOption({ label: bestMatch });
                        console.log(`  ✅ Selected (Best Match): "${bestMatch}" (Score: ${bestScore})`);
                        selectedSomething = true;
                    } else {
                        console.log(`  ⚠️ No good match found for "${data.examLanguage}"`);
                        // DO NOT rely on generic fallback for this important field
                        // Try to select index 1 explicitly here but log it
                        if (options.length > 1) {
                            console.log(`  ⚠️ Force selecting index 1 as fallback for Training Type`);
                            await select.selectOption({ index: 1 });
                            selectedSomething = true; // Prevent generic fallback from overwriting log
                        }
                    }
                }

                // College (has التربية, الحقوق, etc)
                if (!selectedSomething && (optionsStr.includes('تربية') || optionsStr.includes('حقوق') || optionsStr.includes('طب'))) {
                    console.log(`Select ${i}: Detected COLLEGE`);
                    const educationOpt = options.find(o => o.includes('التربية') && !o.includes('النوعية') && !o.includes('الرياضية'));
                    if (educationOpt) {
                        await select.selectOption({ label: educationOpt });
                        console.log(`✅ Selected: ${educationOpt}`);
                        selectedSomething = true;
                    }
                }

                // University (has جامعة options)
                if (!selectedSomething && (optionsStr.includes('جامعة') || optionsStr.includes('سادات'))) {
                    console.log(`Select ${i}: Detected UNIVERSITY`);
                    const sadatOpt = options.find(o => o.includes('السادات') || o.includes('Sadat'));
                    if (sadatOpt) {
                        await select.selectOption({ label: sadatOpt });
                        console.log(`✅ Selected: ${sadatOpt}`);
                        selectedSomething = true;
                    }
                }

                // Fallback: Select index 1 if nothing matched
                if (!selectedSomething && options.length > 1) {
                    await select.selectOption({ index: 1 });
                    console.log(`⚠️ Select ${i}: Fallback to index 1 (${options[1]})`);
                }

            } catch (e) {
                console.log(`Select ${i} error:`, e.message);
            }
        }


        await page.waitForTimeout(450);

        // انتظار قصير أو استقرار الجدول بعد الحفظ (أيهما أسرع)
        console.log('⏳ جاهزية الحفظ...');
        await page.waitForTimeout(900);

        console.log('✅ All fields filled, proceeding to Save NOW');

        // Save - FAST & AGGRESSIVE
        console.log('💾 Step 11: Clicking Save button FAST...');
        let saveClicked = false;

        // Try multiple methods to find save button
        const saveSelectors = [
            'button:has-text("حفظ")',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Save")',
            'button:has-text("إرسال")',
            'form button',
            'button.btn-primary',
            'button.btn-success'
        ];

        for (const selector of saveSelectors) {
            try {
                const btn = page.locator(selector).first();
                const isVisible = await btn.isVisible({ timeout: 500 }).catch(() => false);
                if (isVisible) {
                    console.log(`✅ Found save button with selector: ${selector}`);
                    await btn.click({ force: true }); // Force click
                    saveClicked = true;
                    console.log('✅ Clicked save button (FORCED)');
                    break;
                }
            } catch (e) {
                console.log(`Selector ${selector} failed: ${e.message}`);
            }
        }

        // Try text-based search
        if (!saveClicked) {
            try {
                console.log('Trying text-based button search...');
                const textBtn = page.locator('button, input').filter({ hasText: /حفظ|Save|إرسال|submit/i }).first();
                const isVisible = await textBtn.isVisible({ timeout: 500 }).catch(() => false);
                if (isVisible) {
                    await textBtn.click({ force: true });
                    saveClicked = true;
                    console.log('✅ Clicked save button (text-based FORCED)');
                }
            } catch (e) {
                console.log('⚠️ Text-based save button search failed:', e.message);
            }
        }

        // Last resort: Press Enter
        if (!saveClicked) {
            console.log('⚠️ Save button not found, trying Enter key...');
            try {
                await page.keyboard.press('Enter');
                saveClicked = true;
                console.log('✅ Pressed Enter to save');
            } catch (e) {
                console.log('❌ Error pressing Enter:', e.message);
            }
        }

        if (!saveClicked) {
            console.log('⚠️ Could not find save button - will check result anyway');
        }

        console.log('⏳ انتظار التنقل أو ظهور الجدول بعد الحفظ...');
        await Promise.race([
            page.waitForURL('**/fdtc/**', { timeout: 20000 }).catch(() => { }),
            page.waitForSelector('table tbody tr', { timeout: 20000 }).catch(() => { }),
            page.waitForTimeout(8000)
        ]);
        await page.waitForTimeout(2000);
        await Promise.race([
            page.waitForSelector('table tbody tr', { state: 'visible', timeout: 12000 }).catch(() => { }),
            page.waitForTimeout(3000)
        ]);
        await page.waitForTimeout(2500);

        // 6. Extract Data from Table (أكواد التحول الرقمي)
        console.log('🔍 Step 12: Extracting data from digital transformation codes page...');

        // Wait for table or any data container
        await page.waitForSelector('table tbody', { timeout: 15000 }).catch(() => {
            console.log('⚠️ Table tbody not found, trying to find data in other formats...');
        });

        let result = {};

        // Try to extract from table
        try {
            const table = page.locator('table').first();
            if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Get ONLY tbody rows (skip thead)
                const rows = await table.locator('tbody tr').all();
                console.log(`Found ${rows.length} data rows in table (excluding header)`);

                if (rows.length > 0) {
                    const nidNorm = (data.nationalID || '').replace(/\D/g, '');
                    const emailNorm = (data.email || '').toString().toLowerCase().trim();
                    const emailLocal = emailNorm.split('@')[0] || '';

                    const isHeaderRowCells = (cells) => {
                        const f = (cells[0] || '').trim();
                        return f === 'م' || f === 'الإسم' || f === 'Name' || f === '#' || f === 'No';
                    };

                    let bestCells = null;
                    let bestScore = -1;
                    for (let ri = rows.length - 1; ri >= 0; ri--) {
                        const rowCells = await rows[ri].locator('td').allInnerTexts();
                        if (!rowCells || rowCells.length < 3) continue;
                        if (isHeaderRowCells(rowCells)) continue;
                        const blob = rowCells.join('\t').toLowerCase();
                        let score = ri;
                        if (nidNorm && blob.includes(nidNorm)) score += 5000;
                        if (emailNorm && blob.includes(emailNorm)) score += 4000;
                        if (emailLocal.length > 3 && blob.includes(emailLocal)) score += 2000;
                        const c2 = (rowCells[2] || '').trim();
                        if (/^\d{9,14}$/.test(c2) && !/^01\d{8,10}$/.test(c2)) score += 500;
                        if (score > bestScore) {
                            bestScore = score;
                            bestCells = rowCells;
                        }
                    }

                    let cells = bestCells;
                    if (!cells) {
                        const lastRow = rows[rows.length - 1];
                        cells = await lastRow.locator('td').allInnerTexts();
                    }

                    console.log(`Extracted ${cells.length} cells (row score=${bestScore})`);
                    console.log('Cell values:', cells);

                    const firstCell = cells[0]?.trim() || '';
                    if (firstCell === 'م' || firstCell === 'الإسم' || firstCell === 'Name') {
                        console.log('⚠️ WARNING: best row looks like header, trying second-to-last...');
                        if (rows.length > 1) {
                            const secondLastRow = rows[rows.length - 2];
                            const newCells = await secondLastRow.locator('td').allInnerTexts();
                            console.log('Second-to-last row cells:', newCells);
                            result = {
                                serialNumber: newCells[0]?.trim() || '',
                                name: newCells[1]?.trim() || '',
                                fawryCode: newCells[2]?.trim() || '',
                                mobile: newCells[3]?.trim() || '',
                                whatsapp: newCells[4]?.trim() || '',
                                type: newCells[5]?.trim() || '',
                                value: newCells[6]?.trim() || '',
                                status: newCells[7]?.trim() || '',
                                saveDate: newCells[8]?.trim() || '',
                                allData: newCells
                            };
                        }
                    } else {
                        result = {
                            serialNumber: cells[0]?.trim() || '',
                            name: cells[1]?.trim() || '',
                            fawryCode: cells[2]?.trim() || '',
                            mobile: cells[3]?.trim() || '',
                            whatsapp: cells[4]?.trim() || '',
                            type: cells[5]?.trim() || '',
                            value: cells[6]?.trim() || '',
                            status: cells[7]?.trim() || '',
                            saveDate: cells[8]?.trim() || '',
                            allData: cells
                        };
                    }
                } else {
                    throw new Error('No data rows found in table tbody');
                }
            } else {
                // Try to extract from page content if no table
                console.log('⚠️ No table found, extracting from page content...');
                const pageContent = await page.content();
                const pageText = await page.locator('body').innerText();

                result = {
                    pageContent: pageText.substring(0, 1000), // First 1000 chars
                    note: 'Table not found, extracted page content instead'
                };
            }
        } catch (e) {
            console.log('⚠️ Error extracting from table:', e.message);
            // Try to get page text as fallback
            try {
                const pageText = await page.locator('body').innerText();
                result = {
                    pageText: pageText.substring(0, 2000),
                    error: e.message,
                    note: 'Extracted page text as fallback'
                };
            } catch (e2) {
                result = {
                    error: e.message,
                    note: 'Could not extract data'
                };
            }
        }

        await page.waitForTimeout(1200);
        const bodyForFawry = await page.locator('body').innerText().catch(() => '');
        const patchedFawry = extractLikelyFawryCodeFromDtResult(result, bodyForFawry);
        if (patchedFawry && (isBadFawryCell(result.fawryCode) || String(result.fawryCode).trim() !== patchedFawry)) {
            console.log('🔧 استكمال كود فوري من احتياط (جدول/نص):', patchedFawry);
            result.fawryCode = patchedFawry;
            if (Array.isArray(result.allData) && result.allData.length > 2) {
                const copy = [...result.allData];
                copy[2] = patchedFawry;
                result.allData = copy;
            }
        }

        if (!getFinalFawryCodeFromDtResult(result, bodyForFawry)) {
            try {
                console.log('🔄 احتياط جذري: فتح قائمة الأكواد /fdtc وقراءة نص أوسع (سيرفرات بعيدة عن مصر)...');
                await page.goto('https://eksc.usc.edu.eg/fdtc', { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.waitForTimeout(6000);
                await page.waitForSelector('table tbody', { timeout: 25000 }).catch(() => { });
                const bodyWide = await page.locator('body').innerText().catch(() => '');
                result.pageText = (result.pageText || '') + '\n' + bodyWide.substring(0, 12000);
                result.note = (result.note || '') + ' | fdtc-list-fallback';
                const lateCode = extractLikelyFawryCodeFromDtResult(result, bodyWide);
                if (lateCode && isBadFawryCell(result.fawryCode)) {
                    console.log('🔧 كود فوري من صفحة القائمة:', lateCode);
                    result.fawryCode = lateCode;
                }
            } catch (fbErr) {
                console.log('⚠️ احتياط /fdtc:', fbErr.message);
            }
        }

        console.log('✅ Extracted result:', JSON.stringify(result, null, 2));

        await browser.close();
        return result;

    } catch (error) {
        console.log('❌ Fatal Error:', error);
        // await browser.close(); // Don't close immediately on error to debug? No, keep it clean.
        await browser.close();
        throw error;
    }
}

// =====================================================
// Electronic Payment Automation (USC payment.usc.edu.eg)
// =====================================================

async function runElectronicPaymentAutomation(data) {
    const browser = await chromium.launch({
        headless: true, // Changed to true for production
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    try {
        console.log('🌍 [EP] Step 1: Navigating to payment portal...');
        await page.goto('https://payment.usc.edu.eg/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(2000);

        // -------- Selects: الجهة + نوع الخدمة (ثابت حسب تصميم الموقع) --------
        // من اللوج السابق:
        // Select 0: 0 options
        // Select 1: إختر, كلية التربية, كلية الحقوق...
        // إذن:
        //   select[1] = الجهة (كلية التربية, كلية الحقوق, ...)
        //   select[0] = نوع الخدمة (يتم تحميله بعد اختيار الكلية)

        console.log('📋 [EP] Step 2: Selecting entity "كلية التربية"...');

        const entitySelect = page.locator('select').nth(1);
        const entityOptions = await entitySelect.locator('option').allInnerTexts();
        console.log('[EP] Entity options:', entityOptions);

        const wantedEntity = 'كلية التربية';
        let entityIndex = entityOptions.findIndex(o => normalizeArabic(o).includes(normalizeArabic(wantedEntity)));
        if (entityIndex <= 0 && entityOptions.length > 1) {
            entityIndex = 1; // أول اختيار حقيقي بعد "إختر"
        }

        if (entityIndex > 0) {
            await entitySelect.selectOption({ index: entityIndex });
            console.log(`[EP] ✅ Selected entity: "${entityOptions[entityIndex]}"`);
        } else {
            throw new Error('لم يتم العثور على "كلية التربية" في قائمة الجهة');
        }

        // انتظر حتى يتم تحميل نوع الخدمة بعد اختيار الكلية
        console.log('⏳ [EP] Waiting for service-type options to load...');
        await page.waitForTimeout(4000);

        console.log('📘 [EP] Step 2b: Selecting service type "دبلوم (2025 - 2026)"...');
        const serviceSelect = page.locator('select').first();

        let serviceOptions = await serviceSelect.locator('option').allInnerTexts();
        console.log('[EP] Raw service options:', serviceOptions);

        // أعد المحاولة حتى تظهر الخيارات (في حالة AJAX)
        for (let i = 0; i < 5 && serviceOptions.length <= 1; i++) {
            await page.waitForTimeout(2000);
            serviceOptions = await serviceSelect.locator('option').allInnerTexts();
            console.log(`[EP] Waiting service options... try ${i + 1}:`, serviceOptions);
        }

        if (serviceOptions.length <= 1) {
            throw new Error('قائمة نوع الخدمة لم يتم تحميلها بعد اختيار الكلية');
        }

        const wantedService = 'دبلوم (2025 - 2026)';
        let serviceIndex = serviceOptions.findIndex(o => normalizeArabic(o).includes(normalizeArabic(wantedService)));
        if (serviceIndex <= 0) {
            serviceIndex = serviceOptions.findIndex(o => normalizeArabic(o).includes('دبلوم'));
        }
        if (serviceIndex <= 0) {
            serviceIndex = 1; // أول اختيار حقيقي بعد "إختر"
        }

        await serviceSelect.selectOption({ index: serviceIndex });
        console.log(`[EP] ✅ Selected service: "${serviceOptions[serviceIndex]}"`);

        // -------- تعبئة الحقول النصية --------
        console.log('✉️ [EP] Step 3: Filling all text inputs...');
        const allInputs = await page.locator('input:not([type="password"]):not([type="hidden"]):not([disabled])').all();
        console.log(`[EP] Found ${allInputs.length} text inputs`);

        const dataToFill = [data.email, data.fullNameArabic, data.nationalID, data.phone];
        let dataIndex = 0;

        for (let i = 0; i < allInputs.length && dataIndex < dataToFill.length; i++) {
            try {
                const input = allInputs[i];
                const type = await input.getAttribute('type') || 'text';

                // Skip non-text inputs
                if (type !== 'text' && type !== 'email' && type !== 'tel' && type !== '') {
                    continue;
                }

                await input.fill(dataToFill[dataIndex]);
                console.log(`[EP] ✅ Filled input ${i}: "${dataToFill[dataIndex]}"`);
                dataIndex++;

                await page.waitForTimeout(500);
            } catch (e) {
                console.log(`[EP] Error with input ${i}:`, e.message);
            }
        }

        await page.waitForTimeout(1000);

        // Click "متابعة"
        console.log('➡️ [EP] Step 4: Clicking متابعة...');
        const continueButton = page.locator('button, input').filter({ hasText: /متابعه|متابعة/i }).first();
        if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await continueButton.click();
            await page.waitForTimeout(3000);
        } else {
            throw new Error('لم يتم العثور على زر "متابعة"');
        }

        // Check for errors
        const errorText = await page.locator('.alert, .error, .text-danger, [class*="alert"], [class*="error"]').first().innerText().catch(() => '');
        if (errorText && errorText.length > 5) {
            console.log(`[EP] ⚠️ Error found: ${errorText}`);
            throw new Error(`خطأ من موقع الجامعة: ${errorText}`);
        }

        // Select Fawry Pay -> ادفع فورى -> تأكيد
        console.log('💳 [EP] Step 5: Selecting Fawry Pay...');
        await page.waitForTimeout(2000);

        // أحياناً الأيقونة تكون صورة فقط بدون نص، لذلك نجرب عدّة طرق:
        let fawryClicked = false;

        // 5.0 المحاولة الأوضح: الـ input type="image" الخاص بـ FawryPay
        const fawryInput = page.locator('input#xsrrs, input[type="image"][onclick*="FawryPay"]').first();
        if (await fawryInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[EP] Found Fawry input image (xsrrs), clicking...');
            await fawryInput.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await fawryInput.click({ force: true });
            fawryClicked = true;
        }

        // 5.1 ابحث عن زر / رابط يحتوي على النص (لو فشل الـ input)
        const fawryBtnText = page.locator('button, a, div, span').filter({
            hasText: /fawry|فورى|فوري/i
        }).first();
        if (!fawryClicked && await fawryBtnText.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[EP] Found Fawry element by text, clicking...');
            await fawryBtnText.scrollIntoViewIfNeeded();
            await fawryBtnText.click({ force: true });
            fawryClicked = true;
        }

        // 5.2 إن لم يُوجد نص، ابحث عن صورة شعار Fawry
        if (!fawryClicked) {
            const fawryImg = page.locator('img[src*="fawry" i], img[alt*="fawry" i], img[title*="fawry" i]').first();
            if (await fawryImg.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log('[EP] Found Fawry image, clicking parent button/link...');
                const parent = fawryImg.locator('xpath=ancestor-or-self::button | ancestor-or-self::a | ancestor-or-self::div[1]');
                if (await parent.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await parent.scrollIntoViewIfNeeded();
                    await parent.click({ force: true });
                    fawryClicked = true;
                } else {
                    await fawryImg.scrollIntoViewIfNeeded();
                    await fawryImg.click({ force: true });
                    fawryClicked = true;
                }
            }
        }

        // 5.3 كـ fallback أخير: اضغط آخر صورة في الصفحة (غالباً شعار Fawry أسفل الجدول)
        if (!fawryClicked) {
            const allImgs = await page.locator('img').all();
            console.log(`[EP] No explicit Fawry element found, total images on page: ${allImgs.length}`);
            if (allImgs.length > 0) {
                console.log('[EP] Trying to click last image on page as Fawry fallback...');
                const lastImg = allImgs[allImgs.length - 1];
                try {
                    const src = await lastImg.getAttribute('src');
                    const alt = await lastImg.getAttribute('alt');
                    console.log('[EP] Last image src:', src, 'alt:', alt);
                } catch (e) { }

                try {
                    await lastImg.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(1000);
                    await lastImg.click({ force: true });
                    fawryClicked = true;
                } catch (e) {
                    console.log('[EP] Fallback last-image click failed:', e.message);
                }
            }
        }

        if (!fawryClicked) {
            console.log('[EP] ⚠️ Could not find any Fawry Pay trigger, continuing anyway (will still try to read order number).');
        }

        if (fawryClicked) {
            await page.waitForTimeout(2000);
        }

        // ----- داخل نافذة فوري: اختيار "ادفع فورى" ثم الضغط على "تأكيد" -----
        // ملاحظة: عناصر فوري قد تكون داخل iframe، لذلك نبحث في جميع الـ frames
        console.log('💳 [EP] Step 5b: Selecting "ادفع فورى" inside Fawry modal (frames-aware)...');

        let fawryFrame = null;
        for (let attempt = 0; attempt < 5 && !fawryFrame; attempt++) {
            const frames = page.frames();
            console.log(`[EP] Frames count (attempt ${attempt + 1}):`, frames.length);
            for (const frame of frames) {
                try {
                    const label = frame.locator('#payment-step span.deliver.ng-binding', { hasText: 'ادفع فورى' }).first();
                    if (await label.isVisible({ timeout: 1000 }).catch(() => false)) {
                        fawryFrame = frame;
                        console.log('[EP] ✅ Found Fawry frame containing "ادفع فورى".');
                        break;
                    }
                } catch { }
            }
            if (!fawryFrame) {
                await page.waitForTimeout(1000);
            }
        }

        const frameCtx = fawryFrame || page;

        // 5b.1 اختَر خيار "ادفع فورى"
        const payFawryLabel = frameCtx.locator('#payment-step span.deliver.ng-binding', { hasText: 'ادفع فورى' }).first();
        if (await payFawryLabel.isVisible({ timeout: 8000 }).catch(() => false)) {
            try {
                const payFawryRadio = payFawryLabel.locator('xpath=preceding::input[1]');
                if (await payFawryRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await payFawryRadio.click({ force: true });
                    console.log('[EP] ✅ Selected "ادفع فورى" by clicking radio.');
                } else {
                    await payFawryLabel.click({ force: true });
                    console.log('[EP] ✅ Selected "ادفع فورى" by clicking label.');
                }
            } catch (e) {
                console.log('[EP] ⚠️ Could not click radio for "ادفع فورى":', e.message);
                await payFawryLabel.click({ force: true });
            }
            await frameCtx.waitForTimeout(1500);
        } else {
            console.log('[EP] ⚠️ Could not find "ادفع فورى" option inside any frame.');
        }

        // 5b.2 زر "تأكيد" داخل نافذة فوري
        console.log('💳 [EP] Step 5c: Clicking Fawry "تأكيد" button...');
        const confirmBtn = frameCtx.locator('#billUploadFormConfBTN').first();
        if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            await confirmBtn.scrollIntoViewIfNeeded();
            await frameCtx.waitForTimeout(500);
            await confirmBtn.click({ force: true });
            console.log('[EP] ✅ Clicked Fawry confirm button.');
        } else {
            console.log('[EP] ⚠️ Could not find Fawry confirm button (#billUploadFormConfBTN) in any frame.');
        }

        // Wait for final Fawry payment reference number
        console.log('⏳ [EP] Step 6: Waiting for final Fawry reference (رقم الطلب من فوري)...');
        let orderNumber = '';
        let bodyTextContent = '';

        // انتظر تغيّر الصفحة / الـ URL بعد الضغط على تأكيد
        await Promise.race([
            page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { }),
            page.waitForTimeout(8000)
        ]);

        // نبحث عن رقم الطلب في الصفحة الرئيسية وكل الـ frames
        const searchContexts = [page, ...page.frames()];

        for (let attempt = 0; attempt < 5 && !orderNumber; attempt++) {
            for (const ctx of searchContexts) {
                try {
                    bodyTextContent = await ctx.locator('body').innerText().catch(() => '');
                    if (!bodyTextContent) continue;

                    // 6.1 "رقم الطلب : XXXXX" كما في الصورة
                    const orderMatch = bodyTextContent.match(/رقم الطلب\s*[:\-]?\s*([0-9]+)/);
                    if (orderMatch && orderMatch[1]) {
                        orderNumber = orderMatch[1];
                        console.log('[EP] ✅ Found رقم الطلب:', orderNumber);
                        break;
                    }

                    // 6.2 رقم مرجعي / رقم دفع
                    const fawryMatch =
                        bodyTextContent.match(/رقم المرجعي\s*[:\-]?\s*([0-9]+)/) ||
                        bodyTextContent.match(/رقم الدفع\s*[:\-]?\s*([0-9]+)/);
                    if (fawryMatch && fawryMatch[1]) {
                        orderNumber = fawryMatch[1];
                        console.log('[EP] ✅ Found Fawry reference number:', orderNumber);
                        break;
                    }
                } catch { }
            }

            if (orderNumber) break;

            console.log(`[EP] Fawry reference not found yet, retrying ${attempt + 1}/5...`);
            await page.waitForTimeout(3000);
        }

        if (!orderNumber) {
            console.log('[EP] ⚠️ Fawry reference number not found. Will return empty but include rawText for debugging.');
        } else {
            console.log(`[EP] ✅ Final Fawry reference number: ${orderNumber}`);
        }

        await browser.close();

        return {
            orderNumber,
            entity: 'كلية التربية',
            serviceType: 'دبلوم',
            email: data.email,
            nationalID: data.nationalID,
            status: 'NEW',
            rawText: bodyTextContent.substring(0, 2000)
        };
    } catch (error) {
        console.error('[EP] ❌ Fatal Error:', error);
        await browser.close();
        throw error;
    }
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`🤖 AI Automation Service running on http://${HOST}:${PORT}`);
});
