// Updated Electronic Payment Automation - strictly extract Fawry Reference Number
const { chromium } = require('playwright');

async function runElectronicPaymentAutomation(data) {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    page.setDefaultTimeout(25000);
    page.setDefaultNavigationTimeout(30000);

    try {
        console.log('🌍 [EP] Step 1: Navigating to payment portal (https://payment.usc.edu.eg/)...');
        await page.goto('https://payment.usc.edu.eg/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { });
        await page.waitForTimeout(1000);

        // STEP 1: Select Faculty (الجهة: كلية التربية (دراسات عليا))
        console.log('📋 [EP] Step 2: Selecting faculty (كلية التربية (دراسات عليا))...');
        const facultySelect = page.locator('select#faculty, select[name="faculty"], select[data-faculty-select]').first();
        await facultySelect.waitFor({ state: 'visible', timeout: 15000 });

        let selectedFaculty = false;
        try {
            await facultySelect.selectOption('edu');
            selectedFaculty = true;
            console.log('[EP] ✅ Selected faculty by value="edu"');
        } catch {
            const facultyOpts = await facultySelect.locator('option').all();
            for (const opt of facultyOpts) {
                const text = (await opt.innerText()).trim();
                const val = await opt.getAttribute('value');
                if (text.includes('دراسات عليا') && text.includes('التربية')) {
                    await facultySelect.selectOption(val);
                    selectedFaculty = true;
                    console.log(`[EP] ✅ Selected faculty by text: "${text}" (${val})`);
                    break;
                }
            }
        }

        if (!selectedFaculty) {
            await facultySelect.selectOption({ label: 'كلية التربية (دراسات عليا)' }).catch(async () => {
                await facultySelect.selectOption({ index: 6 });
            });
        }

        await facultySelect.dispatchEvent('change').catch(() => { });
        await page.waitForTimeout(1500);

        // STEP 2: Select Service (الخدمة: دبلوم (2025-2026))
        console.log('📘 [EP] Step 2b: Selecting service (دبلوم (2025-2026))...');
        const serviceSelect = page.locator('select#service, select[name="service"], select[data-service-select]').first();
        await serviceSelect.waitFor({ state: 'visible', timeout: 15000 });

        for (let i = 0; i < 8; i++) {
            const count = await serviceSelect.locator('option').count();
            if (count > 1) break;
            await page.waitForTimeout(1000);
        }

        let selectedService = false;
        try {
            await serviceSelect.selectOption('2');
            selectedService = true;
            console.log('[EP] ✅ Selected service by value="2"');
        } catch {
            const sOptions = await serviceSelect.locator('option').all();
            for (const opt of sOptions) {
                const text = (await opt.innerText()).trim();
                const val = await opt.getAttribute('value');
                if (text.includes('دبلوم') && (text.includes('2025') || text.includes('2026'))) {
                    await serviceSelect.selectOption(val);
                    selectedService = true;
                    console.log(`[EP] ✅ Selected service by text: "${text}" (${val})`);
                    break;
                }
            }
        }

        if (!selectedService) {
            await serviceSelect.selectOption({ index: 1 }).catch(() => { });
            console.log('[EP] ⚠️ Fallback to service index 1');
        }

        await serviceSelect.dispatchEvent('change').catch(() => { });
        await page.waitForTimeout(800);

        // STEP 3: Fill Text Inputs (Name, National ID, Mobile, Email)
        console.log('✉️ [EP] Step 3: Filling user details...');

        const nameInput = page.locator('input#name, input[name="name"]').first();
        if (await nameInput.isVisible({ timeout: 4000 }).catch(() => false)) {
            await nameInput.fill(data.fullNameArabic || '');
            console.log(`[EP] ✅ Name filled: "${data.fullNameArabic}"`);
        } else {
            const firstTxt = page.locator('input:not([type="hidden"]):not([disabled])').first();
            await firstTxt.fill(data.fullNameArabic || '');
        }
        await page.waitForTimeout(200);

        const nidInput = page.locator('input#profileId, input[name="profileId"], input[maxlength="14"]').first();
        if (await nidInput.isVisible({ timeout: 4000 }).catch(() => false)) {
            await nidInput.fill(data.nationalID || '');
            console.log(`[EP] ✅ National ID filled: "${data.nationalID}"`);
        } else {
            const textInputs = await page.locator('input:not([type="hidden"]):not([disabled])').all();
            if (textInputs[1]) await textInputs[1].fill(data.nationalID || '');
        }
        await page.waitForTimeout(200);

        const mobileInput = page.locator('input#mobile, input[name="mobile"], input[maxlength="11"]').first();
        if (await mobileInput.isVisible({ timeout: 4000 }).catch(() => false)) {
            await mobileInput.fill(data.phone || '');
            console.log(`[EP] ✅ Mobile filled: "${data.phone}"`);
        } else {
            const textInputs = await page.locator('input:not([type="hidden"]):not([disabled])').all();
            if (textInputs[2]) await textInputs[2].fill(data.phone || '');
        }
        await page.waitForTimeout(200);

        const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
        if (await emailInput.isVisible({ timeout: 4000 }).catch(() => false)) {
            await emailInput.fill(data.email || '');
            console.log(`[EP] ✅ Email filled: "${data.email}"`);
        } else {
            const textInputs = await page.locator('input:not([type="hidden"]):not([disabled])').all();
            if (textInputs[3]) await textInputs[3].fill(data.email || '');
        }
        await page.waitForTimeout(400);

        // STEP 4: Click متابعة
        console.log('➡️ [EP] Step 4: Clicking متابعة...');
        const continueBtn = page.locator('button[type="submit"], button:has-text("متابعة"), input[value*="متابعة"]').first();
        await continueBtn.scrollIntoViewIfNeeded();
        await continueBtn.click();

        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { }),
            page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { }),
            page.waitForTimeout(4000)
        ]);

        const errorAlert = await page.locator('.alert:not(.alert-info), .error, .text-danger, .invalid-feedback').first().innerText().catch(() => '');
        if (errorAlert && errorAlert.trim().length > 4 && !errorAlert.includes('راجع بياناتك')) {
            console.log(`[EP] ⚠️ Error alert found: ${errorAlert}`);
            throw new Error(`خطأ من موقع الجامعة: ${errorAlert.trim()}`);
        }

        // STEP 5: Click "ادفع عن طريق فوري"
        console.log('💳 [EP] Step 5: Clicking "ادفع عن طريق فوري"...');
        const payFawryBtn = page.locator('button, a, input, div').filter({
            hasText: /ادفع عن طريق فوري|ادفع عن طريق فورى/i
        }).first();

        if (await payFawryBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            await payFawryBtn.scrollIntoViewIfNeeded();
            await payFawryBtn.click({ force: true });
            console.log('[EP] ✅ Clicked "ادفع عن طريق فوري"');
        } else {
            const fallbackFawry = page.locator('button:has-text("فوري"), a:has-text("فوري"), input#xsrrs, img[src*="fawry"]').first();
            if (await fallbackFawry.isVisible({ timeout: 5000 }).catch(() => false)) {
                await fallbackFawry.scrollIntoViewIfNeeded();
                await fallbackFawry.click({ force: true });
                console.log('[EP] ✅ Clicked fallback Fawry button');
            }
        }

        let networkReferenceNumber = '';
        page.on('response', async (response) => {
            try {
                const url = response.url().toLowerCase();
                if (url.includes('fawry') || url.includes('payment') || url.includes('bill') || url.includes('charge')) {
                    const ct = response.headers()['content-type'] || '';
                    if (ct.includes('application/json')) {
                        const json = await response.json().catch(() => null);
                        if (json) {
                            const str = JSON.stringify(json);
                            const m = str.match(/"(?:referenceNumber|fawryRefNumber|paymentRef|paymentReference|reference_number|refNumber|merchantRefNum|referenceNo|refNo)"\s*:\s*"?([0-9]{6,12})"?/i);
                            if (m && m[1] && m[1] !== data.nationalID && !m[1].includes(data.phone)) {
                                networkReferenceNumber = m[1];
                                console.log(`[EP] 🌐 Caught Fawry Reference Number from network API: ${networkReferenceNumber}`);
                            }
                        }
                    }
                }
            } catch { }
        });

        await page.waitForTimeout(2500);

        // STEP 6: Fawry Modal - Select "ادفع فورى" then click "تأكيد"
        console.log('💳 [EP] Step 6: Finding Fawry modal & selecting "ادفع فورى"...');
        let fawryCtx = null;

        for (let attempt = 0; attempt < 8; attempt++) {
            const contexts = [page, ...page.frames()];
            for (const ctx of contexts) {
                try {
                    const payFawryLabel = ctx.locator('label, span, div, p').filter({ hasText: /ادفع فورى|ادفع فوري/i }).first();
                    if (await payFawryLabel.isVisible({ timeout: 500 }).catch(() => false)) {
                        fawryCtx = ctx;
                        break;
                    }
                } catch { }
            }
            if (fawryCtx) break;
            await page.waitForTimeout(1000);
        }

        if (!fawryCtx) {
            fawryCtx = page;
            console.log('[EP] ⚠️ Fawry context default to page.');
        } else {
            console.log('[EP] ✅ Fawry context located.');
        }

        const payFawryOption = fawryCtx.locator('label, span, div, p').filter({ hasText: /ادفع فورى|ادفع فوري/i }).first();
        let selectedFawryRadio = false;

        if (await payFawryOption.isVisible({ timeout: 6000 }).catch(() => false)) {
            try {
                const radio = payFawryOption.locator('xpath=preceding::input[@type="radio"][1]');
                if (await radio.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await radio.click({ force: true });
                    selectedFawryRadio = true;
                    console.log('[EP] ✅ Selected "ادفع فورى" via preceding radio');
                }
            } catch { }

            if (!selectedFawryRadio) {
                try {
                    const radioFollow = payFawryOption.locator('xpath=following::input[@type="radio"][1]');
                    if (await radioFollow.isVisible({ timeout: 1500 }).catch(() => false)) {
                        await radioFollow.click({ force: true });
                        selectedFawryRadio = true;
                        console.log('[EP] ✅ Selected "ادفع فورى" via following radio');
                    }
                } catch { }
            }

            if (!selectedFawryRadio) {
                await payFawryOption.click({ force: true });
                console.log('[EP] ✅ Clicked "ادفع فورى" element directly');
            }
        } else {
            const radioFallback = fawryCtx.locator('input[type="radio"]:nth-of-type(2)').first();
            if (await radioFallback.isVisible({ timeout: 3000 }).catch(() => false)) {
                await radioFallback.click({ force: true });
                console.log('[EP] ✅ Clicked second radio option as fallback');
            }
        }

        await page.waitForTimeout(1000);

        console.log('🔘 [EP] Step 6b: Clicking "تأكيد" button...');
        const confirmBtn = fawryCtx.locator('button, input[type="button"], input[type="submit"], a, div').filter({
            hasText: /^تأكيد$|^تاكيد$/i
        }).first();

        if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            await confirmBtn.scrollIntoViewIfNeeded();
            await confirmBtn.click({ force: true });
            console.log('[EP] ✅ Clicked "تأكيد" button');
        } else {
            const confById = fawryCtx.locator('#billUploadFormConfBTN, button:has-text("تأكيد")').first();
            if (await confById.isVisible({ timeout: 4000 }).catch(() => false)) {
                await confById.click({ force: true });
                console.log('[EP] ✅ Clicked "تأكيد" by id fallback');
            }
        }

        // STEP 7: Extract Final Fawry Reference Number (الرقم المرجعي)
        console.log('⏳ [EP] Step 7: Waiting strictly for Fawry Reference Number (الرقم المرجعي)...');
        let referenceNumber = '';

        for (let attempt = 0; attempt < 15; attempt++) {
            await page.waitForTimeout(1500);

            if (networkReferenceNumber) {
                referenceNumber = networkReferenceNumber;
                console.log(`[EP] ✅ Using Fawry Reference Number from network: ${referenceNumber}`);
                break;
            }

            const contexts = [page, ...page.frames()];

            for (const ctx of contexts) {
                try {
                    const bodyText = await ctx.locator('body').innerText().catch(() => '');
                    if (!bodyText) continue;

                    const refMatch =
                        bodyText.match(/الرقم\s*المرجعي\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/رقم\s*المرجع\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/رقم\s*مرجعي\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/Reference\s*(?:No|Number|Code)?\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/كود\s*الدفع\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/رقم\s*الدفع\s*[:\-]?\s*([0-9]{6,12})/i) ||
                        bodyText.match(/كود\s*فوري\s*[:\-]?\s*([0-9]{6,12})/i);

                    if (refMatch && refMatch[1] && refMatch[1] !== data.nationalID && !refMatch[1].includes(data.phone)) {
                        referenceNumber = refMatch[1].trim();
                        console.log(`[EP] ✅ Found Fawry Reference Number via regex: ${referenceNumber}`);
                        break;
                    }

                    const lines = bodyText.split('\n');
                    for (let l = 0; l < lines.length; l++) {
                        const line = lines[l].trim();
                        if (line.includes('المرجعي') || line.includes('مرجعي') || line.includes('Reference') || line.includes('كود الدفع')) {
                            const numThis = line.match(/([0-9]{6,12})/);
                            if (numThis && numThis[1] !== data.nationalID && !numThis[1].includes(data.phone)) {
                                referenceNumber = numThis[1].trim();
                                console.log(`[EP] ✅ Found Fawry Reference Number on line: ${referenceNumber}`);
                                break;
                            }
                            if (lines[l + 1]) {
                                const numNext = lines[l + 1].trim().match(/^([0-9]{6,12})$/);
                                if (numNext && numNext[1] !== data.nationalID && !numNext[1].includes(data.phone)) {
                                    referenceNumber = numNext[1].trim();
                                    console.log(`[EP] ✅ Found Fawry Reference Number on next line: ${referenceNumber}`);
                                    break;
                                }
                            }
                        }
                    }
                    if (referenceNumber) break;

                    const specificSelectors = [
                        '.ref-num',
                        '.reference-number',
                        '#referenceNumber',
                        '.payment-code',
                        '.fawry-ref',
                        '[data-ref]',
                        '.deliver-code',
                        '.fawry-code',
                        '#refNumber'
                    ];
                    for (const sel of specificSelectors) {
                        const el = ctx.locator(sel).first();
                        if (await el.isVisible({ timeout: 200 }).catch(() => false)) {
                            const val = (await el.innerText().catch(() => '')).trim();
                            const m = val.match(/([0-9]{6,12})/);
                            if (m && m[1] && m[1] !== data.nationalID && !m[1].includes(data.phone)) {
                                referenceNumber = m[1].trim();
                                console.log(`[EP] ✅ Found Fawry Reference Number from selector "${sel}": ${referenceNumber}`);
                                break;
                            }
                        }
                    }
                    if (referenceNumber) break;
                } catch { }
            }

            if (referenceNumber) break;
        }

        let fullBodyText = '';
        try {
            fullBodyText = await page.locator('body').innerText().catch(() => '');
        } catch { }

        await browser.close();

        return {
            orderNumber: referenceNumber,
            referenceNumber: referenceNumber,
            entity: 'كلية التربية (دراسات عليا)',
            serviceType: 'دبلوم (2025-2026)',
            email: data.email,
            nationalID: data.nationalID,
            name: data.fullNameArabic,
            mobile: data.phone,
            status: 'NEW',
            rawText: fullBodyText.substring(0, 3000)
        };
    } catch (error) {
        console.error('[EP] ❌ Fatal Error:', error);
        await browser.close().catch(() => { });
        throw error;
    }
}

module.exports = { runElectronicPaymentAutomation };
