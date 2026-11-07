## 2026-11-06T15:20:48Z
We already have all the exact requirements and constraints approved by the user:
1. File: `src/page/AdminDashboardPage.tsx`
2. Strict constraint: Do NOT delete any function, and do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها").
3. Keep clean code + state management + folder structure.
4. Reduce database queries and realtime listeners (switch to lazy on-demand subscriptions when tabs mount, remove redundant listeners).
5. Verification: run `npm run build` to verify Exit Code 0 with 0 errors after every change.

Please start execution immediately starting from Step 2: Extract ServicesManagementTab (~1,120 lines) to `src/components/admin/configs/ServicesManagementTab.tsx`.

---
### Coordination & Identity:
- **Your Role**: teamwork_orchestrator
- **Working Directory**: `e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator/`
- **Authoritative Request File**: `e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md`
- **Progress Tracking**: Keep `.agents/teamwork/orchestrator/progress.md` and `.agents/teamwork/orchestrator/BRIEFING.md` continuously updated so the Sentinel can monitor progress and report to the user.

### Context & Implementation Roadmap:
1. **Current State (Step 1 Completed)**:
   - 7 config tabs were already extracted to `src/components/admin/configs/`:
     * `BooksConfigTab.tsx`
     * `FeesConfigTab.tsx`
     * `CertificatesConfigTab.tsx`
     * `FinalReviewConfigTab.tsx`
     * `GraduationProjectConfigTab.tsx`
     * `StatementEnrollmentConfigTab.tsx`
     * `DigitalTransformationConfigTab.tsx`
   - Config tabs use lazy subscriptions. Unused real-time subscription for `digitalTransformationCodes` was removed. Pagination for users tab lazy-loaded.
   - Total lines reduced to 8,926 lines. `npm run build` exits 0 with 0 errors.

2. **Immediate Execution Plan**:
   - **Step 2**: Extract `ServicesManagementTab` (located around lines 7000-8120 in `AdminDashboardPage.tsx`, ~1,120 lines including service active/reorder settings, fee configurations, and password-protected restore tools) into `src/components/admin/configs/ServicesManagementTab.tsx`. Wire all required props and state cleanly. Run `npm run build` and ensure 0 errors.
   - **Step 3**: Extract `ElectronicPaymentCodesTab` into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`. Wire up and run `npm run build` with 0 errors.
   - **Step 4**: Modularize the remaining massive `requests` tab (~2,280 lines) into `src/components/admin/requests/AdminRequestsTab.tsx` along with sub-components (toolbar, filters, tables). Wire up and run `npm run build` with 0 errors.
   - **Step 5**: Final verification and testing across the dashboard. Ensure NO functions or logic were removed or altered.


## 2026-11-06T15:23:16Z
CRITICAL USER CONSTRAINT (APPENDED TO ORIGINAL_REQUEST.md):
Do NOT push to git remote (no git push), do NOT deploy, and do NOT upload any update anywhere after finishing. All changes must strictly remain local on the user's disk only.

Ensure all workers, implementers, and reviewers adhere strictly to this constraint.


## 2026-11-06T16:22:35Z
SYSTEM RECOVERY & RESUME NOTICE:
The server restarted and background tasks/subagents were stopped.
Please resume execution immediately:
1. Check the status of `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` and revive/re-dispatch `worker_m2` to finish Milestone 2 (extracting `ElectronicPaymentCodesTab.tsx`, wiring lazy subscriptions, updating `AdminDashboardPage.tsx`).
2. Run compilation gate `npm run build` to verify Exit Code 0 and 0 errors.
3. Once Milestone 2 passes verification, proceed to Milestone 3 (Step 4: modularizing the requests tab into `src/components/admin/requests/AdminRequestsTab.tsx`).
4. Remember strict constraints: 100% functions and logic preserved verbatim, zero deletions/modifications, and strictly local on disk (NO git push to GitHub or any remote).
