/**
 * selfHealingSelector.js
 * ──────────────────────
 * نظام الإصلاح الذاتي للـ Selectors — يكتشف تلقائياً العناصر المتغيرة
 * في صفحة بوابة الدفع الجامعية ويجد البديل الأقرب وظيفياً.
 *
 * الاستخدام:
 *   const { selfHealingLocator } = require('./selfHealingSelector');
 *   const locator = await selfHealingLocator(page, {
 *       description: 'قائمة اختيار الكلية',
 *       primarySelector: 'select:nth-of-type(2)',
 *       fallbackTag: 'select',
 *       expectedTextHints: ['كلية', 'التربية', 'الحقوق'],
 *       timeoutMs: 3000,
 *   });
 */

'use strict';

// ─── تقرير الإصلاح الذاتي ────────────────────────────────────────
const healingReports = [];

function buildHealingReport({ description, primarySelector, healedSelector, score, candidateCount, matchedAttributes, elapsedMs }) {
    const report = {
        timestamp: new Date().toISOString(),
        description,
        originalSelector: primarySelector,
        healedSelector,
        confidenceScore: score,
        candidatesScanned: candidateCount,
        matchedBy: matchedAttributes,
        elapsedMs,
    };
    healingReports.push(report);

    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────');
    console.log('│ 🩹 SELF-HEALING SELECTOR ACTIVATED');
    console.log('│ ─────────────────────────────────────────────────────');
    console.log(`│ 📋 العنصر: ${description}`);
    console.log(`│ ❌ Selector الأصلي (فشل): ${primarySelector}`);
    console.log(`│ ✅ Selector البديل: ${healedSelector}`);
    console.log(`│ 📊 نقاط الثقة: ${score}/100`);
    console.log(`│ 🔍 عدد المرشحين: ${candidateCount}`);
    console.log(`│ 🏷️  تطابق بناءً على: ${matchedAttributes.join(', ')}`);
    console.log(`│ ⏱️  الوقت: ${elapsedMs}ms`);
    console.log('└──────────────────────────────────────────────────────────────');
    console.log('');

    return report;
}

// ─── حساب نقاط التشابه لعنصر مرشّح ──────────────────────────────
function scoreCandidateElement(attrs, hints) {
    let score = 0;
    const matchedAttributes = [];

    // 1. تطابق tag name (select, button, input, a, etc.)
    if (hints.expectedTag && attrs.tagName && attrs.tagName.toLowerCase() === hints.expectedTag.toLowerCase()) {
        score += 15;
        matchedAttributes.push(`tag:${attrs.tagName}`);
    }

    // 2. تطابق النص الداخلي مع الكلمات المتوقعة
    if (hints.expectedTextHints && hints.expectedTextHints.length > 0 && attrs.innerText) {
        const normalizedText = normalizeForMatch(attrs.innerText);
        for (const hint of hints.expectedTextHints) {
            if (normalizedText.includes(normalizeForMatch(hint))) {
                score += 20;
                matchedAttributes.push(`text:${hint}`);
            }
        }
    }

    // 3. تطابق الخيارات الداخلية (للقوائم المنسدلة select)
    if (hints.expectedOptionHints && hints.expectedOptionHints.length > 0 && attrs.optionTexts) {
        const allOptionsNorm = attrs.optionTexts.map(t => normalizeForMatch(t)).join(' ');
        for (const hint of hints.expectedOptionHints) {
            if (allOptionsNorm.includes(normalizeForMatch(hint))) {
                score += 18;
                matchedAttributes.push(`option:${hint}`);
            }
        }
    }

    // 4. تطابق id
    if (hints.expectedIdParts && attrs.id) {
        for (const part of hints.expectedIdParts) {
            if (attrs.id.toLowerCase().includes(part.toLowerCase())) {
                score += 15;
                matchedAttributes.push(`id:${attrs.id}`);
            }
        }
    }

    // 5. تطابق name attribute
    if (hints.expectedNameParts && attrs.name) {
        for (const part of hints.expectedNameParts) {
            if (attrs.name.toLowerCase().includes(part.toLowerCase())) {
                score += 12;
                matchedAttributes.push(`name:${attrs.name}`);
            }
        }
    }

    // 6. تطابق class
    if (hints.expectedClassParts && attrs.className) {
        for (const part of hints.expectedClassParts) {
            if (attrs.className.toLowerCase().includes(part.toLowerCase())) {
                score += 8;
                matchedAttributes.push(`class:${part}`);
            }
        }
    }

    // 7. تطابق placeholder / aria-label
    if (attrs.placeholder && hints.expectedTextHints) {
        const normPh = normalizeForMatch(attrs.placeholder);
        for (const hint of hints.expectedTextHints) {
            if (normPh.includes(normalizeForMatch(hint))) {
                score += 10;
                matchedAttributes.push(`placeholder:${hint}`);
            }
        }
    }
    if (attrs.ariaLabel && hints.expectedTextHints) {
        const normAria = normalizeForMatch(attrs.ariaLabel);
        for (const hint of hints.expectedTextHints) {
            if (normAria.includes(normalizeForMatch(hint))) {
                score += 10;
                matchedAttributes.push(`aria:${hint}`);
            }
        }
    }

    // 8. تطابق الموقع (nth index)
    if (hints.expectedNth !== undefined && attrs.nthIndex === hints.expectedNth) {
        score += 10;
        matchedAttributes.push(`nth:${attrs.nthIndex}`);
    }

    // 9. عدد الخيارات (للقوائم المنسدلة — نفضّل القائمة اللي فيها options أكتر من 1)
    if (attrs.optionCount && attrs.optionCount > 1) {
        score += 5;
        matchedAttributes.push(`options-count:${attrs.optionCount}`);
    }

    // 10. العنصر مرئي وليس مخفياً
    if (attrs.isVisible) {
        score += 5;
        matchedAttributes.push('visible');
    }

    // 11. النص المحيط (label / parent text)
    if (hints.expectedLabelHints && attrs.nearbyText) {
        const normNearby = normalizeForMatch(attrs.nearbyText);
        for (const hint of hints.expectedLabelHints) {
            if (normNearby.includes(normalizeForMatch(hint))) {
                score += 12;
                matchedAttributes.push(`label:${hint}`);
            }
        }
    }

    return { score: Math.min(score, 100), matchedAttributes };
}

// ─── Normalize text for matching (Arabic-aware) ──────────────────
function normalizeForMatch(text = '') {
    return text
        .toString()
        .trim()
        .replace(/[\u0625\u0623\u0622\u0627]/g, '\u0627')  // إأآا → ا
        .replace(/\u0649/g, '\u064A')                        // ى → ي
        .replace(/\u0624/g, '\u0648')                        // ؤ → و
        .replace(/\u0626/g, '\u064A')                        // ئ → ي
        .replace(/\u0629/g, '\u0647')                        // ة → ه
        .replace(/[-\u2013\u2014]/g, ' ')                    // dashes
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

// ─── الدالة الرئيسية: Self-Healing Locator ──────────────────────
/**
 * @param {import('playwright').Page} page — صفحة Playwright
 * @param {object} opts
 * @param {string} opts.description — وصف العنصر (للتقرير)
 * @param {string} opts.primarySelector — الـ selector الأصلي
 * @param {string} opts.fallbackTag — نوع العنصر البديل (select, button, input, a)
 * @param {string[]} [opts.expectedTextHints] — كلمات متوقعة في النص
 * @param {string[]} [opts.expectedOptionHints] — كلمات متوقعة في خيارات القائمة
 * @param {string[]} [opts.expectedIdParts] — أجزاء من الـ id المتوقع
 * @param {string[]} [opts.expectedNameParts] — أجزاء من الـ name المتوقع
 * @param {string[]} [opts.expectedClassParts] — أجزاء من الـ class المتوقع
 * @param {string[]} [opts.expectedLabelHints] — كلمات في label المحيط
 * @param {number}   [opts.expectedNth] — الترتيب المتوقع (index)
 * @param {number}   [opts.timeoutMs=3000] — المهلة لاختبار الـ selector الأصلي
 * @param {number}   [opts.minConfidence=15] — الحد الأدنى لنقاط الثقة لقبول البديل
 * @returns {Promise<import('playwright').Locator|null>} — الـ locator الناجح أو null
 */
async function selfHealingLocator(page, opts) {
    const {
        description = 'عنصر غير معروف',
        primarySelector,
        fallbackTag = 'select',
        expectedTextHints = [],
        expectedOptionHints = [],
        expectedIdParts = [],
        expectedNameParts = [],
        expectedClassParts = [],
        expectedLabelHints = [],
        expectedNth,
        timeoutMs = 3000,
        minConfidence = 15,
    } = opts;

    const startTime = Date.now();

    // ─── الخطوة 1: جرّب الـ selector الأصلي ───
    try {
        const primary = page.locator(primarySelector).first();
        const isVis = await primary.isVisible({ timeout: timeoutMs }).catch(() => false);
        if (isVis) {
            const elapsed = Date.now() - startTime;
            console.log(`[SH] ✅ "${description}" — selector الأصلي يعمل (${elapsed}ms): ${primarySelector}`);
            return primary;
        }
    } catch {
        // الـ selector الأصلي فشل — ننتقل للإصلاح الذاتي
    }

    console.log(`[SH] ⚠️ "${description}" — selector الأصلي فشل: ${primarySelector}`);
    console.log(`[SH] 🔍 بدء الإصلاح الذاتي... البحث عن بديل من نوع <${fallbackTag}>`);

    // ─── الخطوة 2: اجمع كل العناصر المرشحة ───
    const candidates = await page.evaluate((tag) => {
        const elements = document.querySelectorAll(tag);
        return Array.from(elements).map((el, idx) => {
            // جمع السمات
            const attrs = {
                tagName: el.tagName,
                id: el.id || '',
                name: el.getAttribute('name') || '',
                className: el.className || '',
                placeholder: el.getAttribute('placeholder') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                type: el.getAttribute('type') || '',
                innerText: (el.innerText || el.textContent || '').substring(0, 500),
                nthIndex: idx,
                isVisible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
                optionCount: 0,
                optionTexts: [],
                nearbyText: '',
            };

            // خيارات القائمة المنسدلة
            if (el.tagName === 'SELECT') {
                const options = el.querySelectorAll('option');
                attrs.optionCount = options.length;
                attrs.optionTexts = Array.from(options).map(o => (o.textContent || '').trim()).slice(0, 20);
            }

            // النص المحيط (label + parent)
            try {
                const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
                if (labelFor) {
                    attrs.nearbyText = (labelFor.textContent || '').trim();
                } else {
                    const parent = el.parentElement;
                    if (parent) {
                        attrs.nearbyText = (parent.textContent || '').substring(0, 200).trim();
                    }
                }
            } catch { /* ignore */ }

            return attrs;
        });
    }, fallbackTag).catch(() => []);

    if (candidates.length === 0) {
        console.log(`[SH] ❌ لم يتم العثور على أي عنصر <${fallbackTag}> في الصفحة.`);
        return null;
    }

    console.log(`[SH] 📋 تم العثور على ${candidates.length} عنصر مرشح من نوع <${fallbackTag}>`);

    // ─── الخطوة 3: احسب نقاط التشابه لكل مرشح ───
    const hints = {
        expectedTag: fallbackTag,
        expectedTextHints,
        expectedOptionHints,
        expectedIdParts,
        expectedNameParts,
        expectedClassParts,
        expectedLabelHints,
        expectedNth,
    };

    let bestScore = 0;
    let bestIdx = -1;
    let bestMatches = [];

    for (let i = 0; i < candidates.length; i++) {
        const { score, matchedAttributes } = scoreCandidateElement(candidates[i], hints);
        console.log(`[SH]   مرشح #${i}: score=${score} | id="${candidates[i].id}" | options=${candidates[i].optionCount} | matches=[${matchedAttributes.join(', ')}]`);

        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
            bestMatches = matchedAttributes;
        }
    }

    // ─── الخطوة 4: تحقق من الحد الأدنى للثقة ───
    if (bestIdx < 0 || bestScore < minConfidence) {
        const elapsed = Date.now() - startTime;
        console.log(`[SH] ❌ لم يتم العثور على بديل بثقة كافية (أعلى نقاط: ${bestScore}/${minConfidence} حد أدنى)`);
        return null;
    }

    // ─── الخطوة 5: بناء الـ selector الجديد ───
    const winner = candidates[bestIdx];
    let healedSelector;

    if (winner.id) {
        healedSelector = `${fallbackTag}#${winner.id}`;
    } else if (winner.name) {
        healedSelector = `${fallbackTag}[name="${winner.name}"]`;
    } else {
        healedSelector = `${fallbackTag} >> nth=${bestIdx}`;
    }

    const elapsed = Date.now() - startTime;

    // ─── الخطوة 6: أصدر التقرير ───
    buildHealingReport({
        description,
        primarySelector,
        healedSelector,
        score: bestScore,
        candidateCount: candidates.length,
        matchedAttributes: bestMatches,
        elapsedMs: elapsed,
    });

    // ─── الخطوة 7: أرجع الـ locator الجديد ───
    const healed = page.locator(fallbackTag).nth(bestIdx);
    return healed;
}

// ─── دوال مساعدة للاستخدام المتكرر في الأتمتة ──────────────────

/**
 * إيجاد قائمة منسدلة (select) مع إصلاح ذاتي
 */
async function healingSelect(page, { description, nthIndex, expectedOptionHints = [], primarySelector, timeoutMs = 3000 }) {
    return selfHealingLocator(page, {
        description,
        primarySelector: primarySelector || `select >> nth=${nthIndex}`,
        fallbackTag: 'select',
        expectedOptionHints,
        expectedNth: nthIndex,
        timeoutMs,
    });
}

/**
 * إيجاد زر (button) مع إصلاح ذاتي
 */
async function healingButton(page, { description, expectedTextHints = [], primarySelector, timeoutMs = 3000 }) {
    const btn = await selfHealingLocator(page, {
        description,
        primarySelector,
        fallbackTag: 'button',
        expectedTextHints,
        timeoutMs,
    });
    if (btn) return btn;

    // fallback: ابحث في input[type=submit]
    return selfHealingLocator(page, {
        description: description + ' (input fallback)',
        primarySelector: 'input[type="submit"]',
        fallbackTag: 'input[type="submit"], input[type="button"]',
        expectedTextHints,
        timeoutMs: 1500,
    });
}

/**
 * إيجاد حقل إدخال (input) مع إصلاح ذاتي
 */
async function healingInput(page, { description, nthIndex, expectedTextHints = [], primarySelector, timeoutMs = 3000 }) {
    return selfHealingLocator(page, {
        description,
        primarySelector: primarySelector || `input:not([type="password"]):not([type="hidden"]):not([disabled]) >> nth=${nthIndex}`,
        fallbackTag: 'input:not([type="password"]):not([type="hidden"]):not([disabled])',
        expectedTextHints,
        expectedNth: nthIndex,
        timeoutMs,
    });
}

// ─── تصدير ───────────────────────────────────────────────────────
module.exports = {
    selfHealingLocator,
    healingSelect,
    healingButton,
    healingInput,
    scoreCandidateElement,
    normalizeForMatch,
    getHealingReports: () => [...healingReports],
    clearHealingReports: () => { healingReports.length = 0; },
};
