const express = require('express');
const { chromium } = require('playwright');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin (يجب إضافة ملف المفاتيح لاحقاً)
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json'))
// });
// const db = admin.firestore();

// Constants
const TARGET_URL = 'https://eksc.usc.edu.eg/login';

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

    // Start automation in background (Fire and Forget or Await)
    // We will await it to return the result immediately to the UI
    try {
        const result = await runAutomation({
            email, fullNameArabic, fullNameEnglish, phone, examLanguage, nationalID
        });

        // If we had Firebase Admin, we would save here:
        /*
        await db.collection('digitalTransformationCodes').doc(requestId).set({
            ...result,
            studentId,
            status: 'completed',
            createdAt: new Date().toISOString()
        });
        */

        console.log('✅ Automation success:', result);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error('❌ Automation failed:', error.message);
        try {
            // Attempt to take screenshot if possible (would require passing browser context)
        } catch (e) { }

        res.status(500).json({ success: false, error: error.message });
    }
});

async function runAutomation(data) {
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized']
    });
    const context = await browser.newContext({
        viewport: null, // Let the window size dictate the viewport
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Set longer timeout for all operations
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    try {
        // 1. Navigate directly to registration page
        console.log('🌍 Step 1: Navigating to registration page...');
        await page.goto('http://eksc.usc.edu.eg/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('✅ Page loaded, URL:', page.url());
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(2000);

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

        // Wait a bit for the page to process the form
        await page.waitForTimeout(3000);

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
                await page.waitForTimeout(2000);
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

        // If error found or still on register page, go to login
        if (hasError || stillOnRegisterPage) {
            console.log('⚠️ Registration failed - Field value already in use');
            console.log('🔄 Step 5: Navigating to login page...');
            needsLogin = true;

            // Navigate directly to login page
            try {
                await page.goto('https://eksc.usc.edu.eg/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
                console.log('✅ Navigated to login page, URL:', page.url());
                await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });
                await page.waitForTimeout(1000);
            } catch (navError) {
                console.log('❌ Error navigating to login:', navError.message);
                // Try again
                await page.goto('https://eksc.usc.edu.eg/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
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

        // 2. Login - Navigate to /login and login
        if (needsLogin) {
            console.log('🔐 Step 6: Logging in...');

            // Make sure we're on login page (navigate directly to /login)
            if (!page.url().includes('/login')) {
                console.log('Navigating to login page...');
                await page.goto('https://eksc.usc.edu.eg/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });
                await page.waitForTimeout(1000);
            }

            // Wait for login form
            console.log('Waiting for login form...');
            await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 10000 }).catch(() => {
                console.log('⚠️ Email input not found');
            });
            await page.waitForTimeout(1000);

            const emailInput = page.locator('input[type="email"], input[type="text"]').first();
            const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
            console.log('Email input visible:', emailVisible);

            if (emailVisible) {
                await emailInput.clear();
                await emailInput.fill(data.email);
                console.log('✅ Filled email:', data.email);

                const passwordInput = page.locator('input[type="password"]').first();
                const passwordVisible = await passwordInput.isVisible({ timeout: 3000 }).catch(() => false);
                console.log('Password input visible:', passwordVisible);

                if (passwordVisible) {
                    await passwordInput.clear();
                    await passwordInput.fill('StudentPass123!');
                    console.log('✅ Filled password');

                    // Find and click "تسجيل الدخول" button - try multiple methods
                    console.log('Looking for login button...');
                    let loginClicked = false;

                    // Try multiple selectors
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
                            const isVisible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
                            if (isVisible) {
                                console.log(`✅ Found login button with selector: ${selector}`);
                                await btn.click();
                                loginClicked = true;
                                console.log('✅ Clicked login button');
                                break;
                            }
                        } catch (e) {
                            // Continue to next selector
                        }
                    }

                    // Try text-based search
                    if (!loginClicked) {
                        try {
                            const textBtn = page.locator('button, input').filter({ hasText: /تسجيل الدخول|تسجيل|دخول|login|Login/i }).first();
                            const isVisible = await textBtn.isVisible({ timeout: 2000 }).catch(() => false);
                            if (isVisible) {
                                await textBtn.click();
                                loginClicked = true;
                                console.log('✅ Clicked login button (text-based)');
                            }
                        } catch (e) {
                            console.log('⚠️ Text-based login button search failed');
                        }
                    }

                    // Last resort: Press Enter
                    if (!loginClicked) {
                        console.log('⚠️ Login button not found, trying Enter key...');
                        try {
                            await passwordInput.focus();
                            await page.keyboard.press('Enter');
                            loginClicked = true;
                            console.log('✅ Pressed Enter to login');
                        } catch (e) {
                            console.log('❌ Error pressing Enter:', e.message);
                        }
                    }

                    // Wait for navigation
                    if (loginClicked) {
                        await page.waitForTimeout(2000);
                        await Promise.race([
                            page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { }),
                            page.waitForURL('**/home**', { timeout: 10000 }).catch(() => { }),
                            page.waitForURL('**/fdtc**', { timeout: 10000 }).catch(() => { }),
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { }),
                            page.waitForTimeout(5000)
                        ]);
                        console.log('✅ Login completed, current URL:', page.url());
                    }
                } else {
                    console.log('❌ Password input not found');
                }
            } else {
                console.log('⚠️ Login form not found, assuming already logged in');
            }
        } else {
            console.log('ℹ️ Login not needed, already logged in');
        }

        // 3. Navigate directly to registration form
        console.log('📚 Step 7: Navigating to form page (fdtc/create)...');
        await page.goto('https://eksc.usc.edu.eg/fdtc/create', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ Form page loaded, URL:', page.url());
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(2000);

        // Wait for form to be ready
        console.log('Waiting for form elements...');
        await page.waitForSelector('input, select', { timeout: 10000 }).catch(() => {
            console.log('⚠️ Form elements not found');
        });

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
                // Check if any select has a value (not "اختر" or empty)
                if (selectedValue && selectedValue !== 'اختر' && selectedValue !== '' && !selectedValue.includes('Select')) {
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
                    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });
                    await page.waitForSelector('input, select', { timeout: 5000 }).catch(() => { });
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
            'input[placeholder*="العربية"]',
            'input[placeholder*="عربي"]',
            'input[name*="arabic"]',
            'input[name*="ar"]'
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
            'input[placeholder*="الإنجليزية"]',
            'input[placeholder*="إنجليزي"]',
            'input[placeholder*="English"]',
            'input[name*="english"]',
            'input[name*="en"]'
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
        await page.waitForTimeout(1000);

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
                    name.toLowerCase().includes('tel')) {
                    valueToFill = data.phone;
                    fieldType = 'PHONE';
                }
                // ARABIC NAME - Must have explicit indicators
                else if (placeholder.includes('عربي') ||
                    placeholder.includes('العربية') ||
                    placeholder.includes('عربى') ||
                    name.toLowerCase().includes('arabic') ||
                    name.toLowerCase().includes('ar_name')) {
                    valueToFill = data.fullNameArabic;
                    fieldType = 'ARABIC NAME';
                }
                // ENGLISH NAME - Must have explicit indicators
                else if (placeholder.includes('إنجليزي') ||
                    placeholder.includes('الإنجليزية') ||
                    placeholder.includes('انجليزي') ||
                    placeholder.toLowerCase().includes('english') ||
                    name.toLowerCase().includes('english') ||
                    name.toLowerCase().includes('en_name')) {
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


        await page.waitForTimeout(1000);

        // Skip all verification - just wait a bit and save
        console.log('⏳ Waiting 2 seconds before clicking Save...');
        await page.waitForTimeout(2000);

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

        // Wait for navigation or table to appear - LONGER WAIT
        console.log('⏳ Waiting for page to navigate after save...');
        await page.waitForTimeout(3000); // Wait 3 seconds for navigation

        await Promise.race([
            page.waitForURL('**/fdtc/**', { timeout: 10000 }).catch(() => { }),
            page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => { }),
            page.waitForTimeout(5000) // Longer fallback
        ]);

        // Additional wait for table to fully load
        console.log('⏳ Waiting for table to fully load...');
        await page.waitForTimeout(3000);

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
                    // Get the last row (most recent entry)
                    const lastRow = rows[rows.length - 1];
                    const cells = await lastRow.locator('td').allInnerTexts(); // Use 'td' not 'td, th'

                    console.log(`Extracted ${cells.length} cells from last row`);
                    console.log('Cell values:', cells);

                    // Verify this is not a header row
                    const firstCell = cells[0]?.trim() || '';
                    if (firstCell === 'م' || firstCell === 'الإسم' || firstCell === 'Name') {
                        console.log('⚠️ WARNING: Got header row instead of data! Trying second-to-last row...');
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
                            serialNumber: cells[0]?.trim() || '',      // م
                            name: cells[1]?.trim() || '',               // الإسم
                            fawryCode: cells[2]?.trim() || '',          // رقم فوري
                            mobile: cells[3]?.trim() || '',             // موبايل
                            whatsapp: cells[4]?.trim() || '',           // Whatsapp
                            type: cells[5]?.trim() || '',               // النوع
                            value: cells[6]?.trim() || '',              // القيمة
                            status: cells[7]?.trim() || '',             // الحالة
                            saveDate: cells[8]?.trim() || '',           // تاريخ الحفظ
                            allData: cells // Include all data for debugging
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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🤖 AI Automation Service running on port ${PORT}`);
});
