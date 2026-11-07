## 2026-11-06T17:56:24Z

You are worker_m3_fix (Role: Requests TypeScript & Logic Fix Worker).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\worker_m3_fix/

Context & Objective:
Apply the surgical fixes identified by explorer_m3_fix to resolve the 3 `npx tsc --noEmit` compiler errors and restore 100% Arabic service name fidelity to canonical `AdminDashboardPage.tsx` behavior.

Authoritative Documents to Read:
1. `e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md` (Strict constraints: zero function deletion, zero logic alteration, strictly local on disk, no git push)
2. `e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_fix\handoff.md` (Contains exact code blocks and diffs)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Surgical Changes to Implement:
1. `src/components/admin/requests/requestsHelpersCore.ts`:
   Replace `getServiceNameHelper` (lines 98-119) with the canonical implementation matching `AdminDashboardPage.tsx`:
   ```typescript
   export const getServiceNameHelper = (
     serviceId: string,
     bookServiceName?: string,
     assignmentsServiceName?: string,
     finalReviewServiceName?: string
   ): string => {
     if (!serviceId) return 'خدمة غير معروفة';
     if (serviceId === '3' && bookServiceName) {
       return bookServiceName;
     }
     if (serviceId === '5' && assignmentsServiceName) {
       return assignmentsServiceName;
     }
     if (serviceId === '8' && finalReviewServiceName) {
       return finalReviewServiceName;
     }
     const serviceNames: Record<string, string> = {
       '1': 'سجل بياناتك',
       '2': 'العميل المميز',
       '3': 'شحن الكتب الدراسية',
       '4': 'دفع المصروفات الدراسية',
       '5': 'حل وتسليم تكليفات',
       '6': 'شهادات اونلاين',
       '7': 'التقديم علي التحول الرقمي',
       '8': 'المراجعة النهائية',
       '9': 'مشروع التخرج',
       '10': 'استخراج مستندات',
       '11': 'استلام و شحن التحول الرقمي',
       '12': 'التقديم علي افادة و اثبات قيد'
     };
     return serviceNames[serviceId] || `خدمة ${serviceId}`;
   };
   ```

2. `src/components/admin/requests/AdminRequestsTab.tsx:152`:
   Change:
   `const requestsScrollContainerRef = useRef<HTMLDivElement | null>(null);`
   To:
   `const requestsScrollContainerRef = useRef<HTMLDivElement>(null);`

3. `src/components/admin/requests/AdminRequestsTable.tsx:59`:
   Change:
   `requestsScrollContainerRef: React.RefObject<HTMLDivElement | null>;`
   To:
   `requestsScrollContainerRef: React.RefObject<HTMLDivElement>;`

4. `src/components/admin/codes/ElectronicPaymentCodesTab.tsx:380`:
   Change:
   `<button onClick={() => handleDeleteEPCode(code.id)} ...>`
   To:
   `<button onClick={() => { if (code.id) handleDeleteEPCode(code.id); }} ...>`

5. `src/components/admin/requests/requestsHelpers.test.ts`:
   Update test for `getServiceNameHelper` to test canonical Arabic service names, config overrides for services 3, 5, 8, and the canonical fallback `'خدمة 99999'`.

Empirical Verification Requirements:
1. Run `npx tsc --noEmit` using `run_command` and verify Exit Code 0 (0 errors).
2. Run `node --experimental-strip-types --test src/components/admin/requests/requestsHelpers.test.ts` and verify 100% tests pass.
3. Run `npm test` and verify 10/10 tests pass.
4. Run `npm run build` and verify Exit Code 0.
5. Verify `git status` confirms zero commits and zero remote git operations.
