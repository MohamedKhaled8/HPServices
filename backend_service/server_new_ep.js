// SIMPLE Electronic Payment Automation - Based on working Digital Transformation logic
const { chromium } = require('playwright');

async function runElectronicPaymentAutomation(data) {
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized']
    });
    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    try {
        console.log('🌍 [EP] Navigating to payment portal...');
        await page.goto('https://payment.usc.edu.eg/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(2000);

        // STEP 1: Fill ALL selects - just select index 1 for each
        console.log('📋 [EP] Filling all select dropdowns...');
        const allSelects = await page.locator('select:not([disabled])').all();
        console.log(`[EP] Found ${allSelects.length} selects`);

        for (let i = 0; i < allSelects.length; i++) {
            try {
                const select = allSelects[i];
                const options = await select.locator('option').allInnerTexts();
                console.log(`[EP] Select ${i}: ${options.length} options`);

                if (options.length > 1) {
                    await select.selectOption({ index: 1 });
                    console.log(`[EP] ✅ Selected: "${options[1]}"`);
                    await page.waitForTimeout(2000); // Wait for dependent dropdowns
                }
            } catch (e) {
                console.log(`[EP] Select ${i} error:`, e.message);
            }
        }

        // STEP 2: Fill ALL text inputs in order
        console.log('✉️ [EP] Filling all text inputs...');
        const allInputs = await page.locator('input:not([type="password"]):not([type="hidden"]):not([disabled])').all();
        console.log(`[EP] Found ${allInputs.length} inputs`);

        const dataToFill = [data.email, data.fullNameArabic, data.nationalID, data.phone];
        let dataIndex = 0;

        for (let i = 0; i < allInputs.length && dataIndex < dataToFill.length; i++) {
            try {
                const input = allInputs[i];
                await input.fill(dataToFill[dataIndex]);
                console.log(`[EP] ✅ Filled input ${i}: "${dataToFill[dataIndex]}"`);
                dataIndex++;
                await page.waitForTimeout(500);
            } catch (e) {
                console.log(`[EP] Input ${i} error:`, e.message);
            }
        }

        await page.waitForTimeout(1000);

        // STEP 3: Click متابعة
        console.log('➡️ [EP] Clicking متابعة...');
        const continueBtn = page.locator('button, input').filter({ hasText: /متابعه|متابعة/i }).first();
        if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await continueBtn.click();
            await page.waitForTimeout(3000);
        }

        // Check for errors
        const errorText = await page.locator('.alert, .error').first().innerText().catch(() => '');
        if (errorText && errorText.length > 5) {
            throw new Error(`خطأ: ${errorText}`);
        }

        // STEP 4: Fawry Pay
        console.log('💳 [EP] Selecting Fawry Pay...');
        const fawryBtn = page.locator('button, img, a, div, span').filter({ hasText: /fawry|فورى|فوري/i }).first();
        if (await fawryBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            await fawryBtn.click({ force: true });
            await page.waitForTimeout(2000);
        }

        const payNowBtn = page.locator('button, a, div, span').filter({ hasText: /ادفع فورى|ادفع فوري/i }).first();
        if (await payNowBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            await payNowBtn.click();
            await page.waitForTimeout(2000);
        }

        const confirmBtn = page.locator('button, a, div, input, span').filter({ hasText: /تأكيد|تاكيد|Confirm/i }).first();
        if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            await confirmBtn.click();
        }

        // STEP 5: Extract order number
        console.log('⏳ [EP] Waiting for order number...');
        let orderNumber = '';
        let bodyText = '';

        for (let i = 0; i < 5; i++) {
            await page.waitForTimeout(3000);
            bodyText = await page.locator('body').innerText().catch(() => '');

            const match = bodyText.match(/رقم الطلب[:\-]?\s*([0-9]+)/) ||
                bodyText.match(/رقم المرجعي[:\-]?\s*([0-9]+)/) ||
                bodyText.match(/([0-9]{8,})/);

            if (match && match[1]) {
                const num = match[1];
                if (num !== data.nationalID && !num.includes(data.phone)) {
                    orderNumber = num;
                    break;
                }
            }
        }

        console.log(`[EP] ✅ Order number: ${orderNumber || 'NOT FOUND'}`);

        await browser.close();

        return {
            orderNumber,
            entity: 'كلية التربية',
            serviceType: 'دبلوم',
            email: data.email,
            nationalID: data.nationalID,
            status: 'NEW',
            rawText: bodyText.substring(0, 2000)
        };
    } catch (error) {
        console.error('[EP] ❌ Error:', error);
        await browser.close();
        throw error;
    }
}

module.exports = { runElectronicPaymentAutomation };
