# Original User Request

## Parameters
[skip-interview]
How this run was launched; not part of the task.

## Initial Request — 2026-11-06T15:20:05Z

We already have all the exact requirements and constraints approved by the user:
1. File: `src/page/AdminDashboardPage.tsx`
2. Strict constraint: Do NOT delete any function, and do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها").
3. Keep clean code + state management + folder structure.
4. Reduce database queries and realtime listeners (switch to lazy on-demand subscriptions when tabs mount, remove redundant listeners).
5. Verification: run `npm run build` to verify Exit Code 0 with 0 errors after every change.

Please start execution immediately starting from Step 2: Extract ServicesManagementTab (~1,120 lines) to `src/components/admin/configs/ServicesManagementTab.tsx`.

Context & Road Map:
- Step 1 COMPLETED:
  * Extracted 7 self-contained service config tabs to `src/components/admin/configs/` (`BooksConfigTab.tsx`, `FeesConfigTab.tsx`, `CertificatesConfigTab.tsx`, `FinalReviewConfigTab.tsx`, `GraduationProjectConfigTab.tsx`, `StatementEnrollmentConfigTab.tsx`, `DigitalTransformationConfigTab.tsx`).
  * Converted to lazy on-demand subscriptions.
  * Line count reduced from 10,059 to 8,926 lines. `npm run build` verified cleanly with 0 errors.
- Step 2: Extract `ServicesManagementTab` (lines ~7000-8120 in `AdminDashboardPage.tsx`, ~1,120 lines including service active/reorder settings and password-protected restore tools) into `src/components/admin/configs/ServicesManagementTab.tsx`.
- Step 3: Extract `ElectronicPaymentCodesTab` into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`.
- Step 4: Modularize the remaining massive `requests` tab (~2,280 lines) into `src/components/admin/requests/AdminRequestsTab.tsx` along with its toolbar and spreadsheet components.
- Step 5: Final build and verification (`npm run build`).


## Follow-up — 2026-11-06T15:23:06Z

CRITICAL USER INSTRUCTION:
Do NOT push to git remote (no git push), do NOT deploy, and do NOT upload any update anywhere after finishing. All changes must strictly remain local on the user's disk only.


## Follow-up — 2026-11-06T15:23:16Z
Do NOT push to git remote (no git push), do NOT deploy, and do NOT upload any update anywhere after finishing. All changes must strictly remain local on the user's disk only.


## Follow-up — 2026-11-06T15:23:43Z

User reminder: Absolutely do NOT push to GitHub (no git push to GitHub under any circumstances). All files must remain strictly local on disk.


## Follow-up — 2026-11-06T16:22:13Z

Server was restarted and previous background tasks/workers stopped. Please resume execution immediately:
1. Revive/re-dispatch worker_m2 to finish Step 3 (extracting `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` and updating `AdminDashboardPage.tsx`).
2. Run compilation gate `npm run build` to confirm 0 errors.
3. Proceed to Step 4 (modularizing the requests tab into `src/components/admin/requests/AdminRequestsTab.tsx`).
4. Strict constraints: Preserving 100% of functions and logic without deletion or behavioral change, and strictly local on disk (NO git push to GitHub or anywhere).
