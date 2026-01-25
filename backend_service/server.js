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
        args: ['--no-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('🌍 Navigating to site...');
        await page.goto(TARGET_URL, { timeout: 60000 });

        // 1. Check if we need to Register or Login
        console.log('👤 Attempting registration...');

        const registerBtn = page.getByText('تسجيل حساب جديد', { exact: false }).first();
        if (await registerBtn.isVisible()) {
            await registerBtn.click();
            await page.waitForTimeout(2000);

            console.log('📝 Filling registration form...');

            // Wait minimal time
            await page.waitForTimeout(500);

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

                        // Check if placeholder contains actual Arabic characters (not just the word "عربي")
                        const hasArabicChars = /[\u0621-\u064A]/.test(placeholder);

                        console.log(`  Name field detected: placeholder="${placeholder}", hasArabicKeyword=${hasArabicKeyword}, hasEnglishKeyword=${hasEnglishKeyword}, hasArabicChars=${hasArabicChars}`);

                        if (hasArabicKeyword && !filledArabicName) {
                            // Explicitly says "عربي" or "العربية"
                            valueToFill = data.fullNameArabic;
                            fieldLabel = 'Arabic Name';
                            filledArabicName = true;
                        }
                        else if (hasEnglishKeyword && !filledEnglishName) {
                            // Explicitly says "إنجليزي" or "English"
                            valueToFill = data.fullNameEnglish;
                            fieldLabel = 'English Name';
                            filledEnglishName = true;
                        }
                        else if (!filledArabicName) {
                            // First name field defaults to Arabic
                            valueToFill = data.fullNameArabic;
                            fieldLabel = 'Arabic Name (first field)';
                            filledArabicName = true;
                        }
                        else if (!filledEnglishName) {
                            // Second name field defaults to English
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

            // Fill ALL password fields (both password and confirm)
            console.log('🔐 Filling password fields...');
            const password = 'StudentPass123!';
            const passInputs = await page.locator('input[type="password"]').all();
            console.log(`Found ${passInputs.length} password fields`);

            for (let i = 0; i < passInputs.length; i++) {
                try {
                    await passInputs[i].fill(password);
                    console.log(`✅ Password ${i + 1} filled`);
                } catch (e) {
                    console.log(`❌ Password ${i} error:`, e.message);
                }
            }

            // Submit - try multiple methods
            console.log('📤 Submitting...');
            let submitted = false;

            // Method 1: Look for button with Arabic text
            try {
                const arabicBtn = page.locator('button').filter({ hasText: /تسجيل|حفظ|إرسال/ }).first();
                if (await arabicBtn.isVisible({ timeout: 1000 })) {
                    await arabicBtn.click();
                    console.log('✅ Clicked Arabic submit button');
                    submitted = true;
                }
            } catch (e) { }

            // Method 2: type="submit"
            if (!submitted) {
                try {
                    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
                    if (await submitBtn.isVisible({ timeout: 1000 })) {
                        await submitBtn.click();
                        console.log('✅ Clicked submit button');
                        submitted = true;
                    }
                } catch (e) { }
            }

            // Method 3: Press Enter on last field
            if (!submitted) {
                try {
                    await page.keyboard.press('Enter');
                    console.log('✅ Pressed Enter to submit');
                    submitted = true;
                } catch (e) { }
            }

            if (!submitted) {
                console.log('⚠️ Could not submit form');
            }

            await page.waitForTimeout(3000);
        }

        // 2. Login
        console.log('🔐 Checking Login...');
        if (await page.locator('input[type="email"]').isVisible()) {
            // ... login logic ...
            await page.fill('input[type="email"]', data.email);
            await page.fill('input[type="password"]', 'StudentPass123!');
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => { });
        }

        // 3. Navigate to Digital Transformation
        console.log('📚 Navigating to Course...');
        await page.getByText('التحول الرقمي', { exact: false }).first().click();

        // 4. New Booking
        console.log('➕ Clicking New Booking...');
        await page.waitForTimeout(2000);
        const newBookingBtn = page.locator('button, a').filter({ hasText: /حجز جديد|New Booking/ }).first();
        await newBookingBtn.click();
        await page.waitForTimeout(2000);

        // 5. Fill Booking Form
        console.log('📝 Filling booking form...');
        await page.waitForTimeout(1000);

        // Get all inputs
        const bookingInputs = await page.locator('input:not([type="password"])').all();
        console.log(`Found ${bookingInputs.length} inputs in booking form`);

        // Fill name fields smartly
        let filledArabicBooking = false;
        let filledEnglishBooking = false;
        let filledPhoneBooking = false;

        for (const input of bookingInputs) {
            try {
                const placeholder = await input.getAttribute('placeholder') || '';
                const name = (await input.getAttribute('name') || '').toLowerCase();
                const type = await input.getAttribute('type') || '';

                // Arabic Name
                if (!filledArabicBooking && (placeholder.includes('عربي') || placeholder.includes('عربى') || name.includes('ar'))) {
                    await input.fill(data.fullNameArabic);
                    console.log('✅ Filled Arabic name in booking');
                    filledArabicBooking = true;
                }
                // English Name
                else if (!filledEnglishBooking && (placeholder.includes('إنجليزي') || placeholder.includes('انجليزي') || placeholder.includes('English') || name.includes('en'))) {
                    await input.fill(data.fullNameEnglish);
                    console.log('✅ Filled English name in booking');
                    filledEnglishBooking = true;
                }
                // Phone
                else if (!filledPhoneBooking && (type === 'tel' || name.includes('phone') || name.includes('mobile') || placeholder.includes('هاتف') || placeholder.includes('محمول'))) {
                    await input.fill(data.phone);
                    console.log('✅ Filled phone in booking');
                    filledPhoneBooking = true;
                }
            } catch (e) {
                console.log('Error filling booking input:', e.message);
            }
        }

        // Fill selects
        console.log('📋 Filling dropdowns...');
        const selects = await page.locator('select').all();
        for (const select of selects) {
            try {
                const label = await select.evaluate(el => {
                    const labelEl = document.querySelector(`label[for="${el.id}"]`);
                    return labelEl ? labelEl.textContent : '';
                });
                const nearbyText = await select.evaluate(el => el.previousElementSibling?.textContent || '');
                const context = label + ' ' + nearbyText;

                console.log(`Select context: "${context}"`);

                // Training Type (same as exam language)
                if (context.includes('نوع') || context.includes('التدريب') || context.includes('Type')) {
                    await select.selectOption({ label: data.examLanguage }).catch(async () => {
                        // Try by value
                        const options = await select.locator('option').all();
                        for (const opt of options) {
                            const text = await opt.textContent();
                            if (text && text.includes(data.examLanguage)) {
                                await select.selectOption({ label: text });
                                break;
                            }
                        }
                    });
                    console.log(`✅ Selected training type: ${data.examLanguage}`);
                }
                // College
                else if (context.includes('الكلية') || context.includes('College')) {
                    await select.selectOption({ label: 'التربية' }).catch(() => {
                        console.log('⚠️ Could not select التربية, trying index');
                        return select.selectOption({ index: 1 });
                    });
                    console.log('✅ Selected college: التربية');
                }
                // University
                else if (context.includes('الجامعة') || context.includes('University')) {
                    await select.selectOption({ label: 'السادات' }).catch(async () => {
                        // Try variations
                        await select.selectOption({ label: 'مدينة السادات' }).catch(() => {
                            console.log('⚠️ Could not select السادات, trying index');
                            return select.selectOption({ index: 1 });
                        });
                    });
                    console.log('✅ Selected university: السادات');
                }
            } catch (e) {
                console.log('Error with select:', e.message);
            }
        }

        // Save
        console.log('💾 Clicking Save...');
        await page.waitForTimeout(500);
        const saveBtn = page.locator('button').filter({ hasText: /حفظ|Save|إرسال/ }).first();
        await saveBtn.click();
        await page.waitForTimeout(3000);

        // 6. Extract Data from Table
        console.log('🔍 Extracting data from table...');
        await page.waitForSelector('table', { timeout: 30000 });

        // Get the last row (most recent booking)
        const rows = await page.locator('table tbody tr').all();
        if (rows.length === 0) {
            throw new Error('No rows found in table');
        }

        const lastRow = rows[rows.length - 1];
        const cells = await lastRow.locator('td').allInnerTexts();

        console.log(`Extracted ${cells.length} cells from table`);
        console.log('Cell values:', cells);

        const result = {
            serialNumber: cells[0] || '',      // م
            name: cells[1] || '',               // الإسم
            fawryCode: cells[2] || '',          // رقم فوري
            mobile: cells[3] || '',             // موبايل
            whatsapp: cells[4] || '',           // Whatsapp
            type: cells[5] || '',               // النوع
            value: cells[6] || '',              // القيمة
            status: cells[7] || '',             // حالة الطلب
            actions: cells[8] || ''             // الإجراءات
        };

        console.log('✅ Extracted result:', result);

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
