## 2026-11-06T15:34:32Z
You are the Worker for Milestone 1 (Step 2 - Extract ServicesManagementTab).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\worker_m1/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project context and synthesis at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md
Read the 3 Explorer handoff reports:
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_1\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_2\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_3\handoff.md

FILE OWNERSHIP:
You have exclusive write ownership over:
- `src/components/admin/configs/ServicesManagementTab.tsx` (to be created)
- `src/page/AdminDashboardPage.tsx` (to be modified)
Do not touch any other files.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL USER CONSTRAINTS:
1. Strict constraint: Do NOT delete any function, and do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها").
2. Do NOT push to git remote (no git push), do NOT deploy, and do NOT upload any update anywhere after finishing. All changes must strictly remain local on the user's disk only.
3. Keep clean code + state management + folder structure.
4. Reduce database queries and realtime listeners (switch to lazy on-demand subscriptions when tabs mount, remove redundant listeners).
5. Verification: run `npm run build` to verify Exit Code 0 with 0 errors after every change.

DETAILED IMPLEMENTATION INSTRUCTIONS:
1. Create `src/components/admin/configs/ServicesManagementTab.tsx`:
   - Transfer all 22 restore, cleanup, and reordering functions verbatim from `AdminDashboardPage.tsx`.
   - Include the Clean Password modal (`isCleanPasswordModalOpen`, lines 6784-6868).
   - Implement lazy subscription for `serviceSettings` with cleanup on unmount.
   - Accept props per the `ServicesManagementTabProps` interface contract detailed in `PROJECT.md` and Explorer handoffs.
2. Update `src/page/AdminDashboardPage.tsx`:
   - Import `ServicesManagementTab` from `../components/admin/configs/ServicesManagementTab`.
   - Replace lines 6264-6781 (services tab JSX) with `<ServicesManagementTab ... />`.
   - Remove lines 6784-6868 (Clean Password Modal JSX, now inside `ServicesManagementTab`).
   - Remove the extracted restore, cleanup, and reordering functions and unused state from `AdminDashboardPage.tsx`:
     * `isServiceActive`, `getDisabledFields` (lines 1257-1270)
     * `tryUnlockRestoreTools`, `guardRestoreAction`, `handleCleanOldCompletedRequests`, `handleCleanPasswordConfirm`, `handleRestoreServiceFromStudents`, `handleRestoreGraduationProjectOnly`, `handleRestoreService1Only`, `restoreCloudinaryOrdersToFirestore`, `handleRestoreService2Only`, `handleRestoreServiceFromCloudinary`, single-service restore handlers 3-11, `handleRemoveDuplicateRequests`, `handleEnrichRestoredOrdersFromStudents`, `handleEnrichGraduationProjectOnly`, `handleSyncRealCloudinaryImages` (lines 2911-3463)
     * `moveServiceManual` (lines 3756-3780)
     * Unused state variables: `isCleaningOldRequests`, `cleanPasswordInput`, `cleanPasswordError`, `isCleanPasswordModalOpen`, `restorePasswordInput`, `restorePasswordError`, `draggedServiceId`, `serviceSettings`, `isRestoringServices`, `isRestoringGradProject`, `isSyncingCloudinary`, `isEnrichingOrders`, `isRemovingDuplicates`.
     * Remove the unconditional `subscribeToServiceSettings` listener at dashboard mount (lines 1533-1538).
   - CRITICAL WARNING: Do NOT touch or remove lines 6870-7388 (`isEditingRequestModalOpen`, `isEditingStudent`, `viewingStudentRequests`) as they belong to requests and users tabs!
   - Keep `restoreToolsUnlocked` in `AdminDashboardPage.tsx` because it is used by the background student auto-enrichment effect at lines 1325/1369. Pass `restoreToolsUnlocked` and `setRestoreToolsUnlocked` to `ServicesManagementTab`.
   - Keep `runAutoFixPlaceholderOrders` and `isAutoFixingOrders` in `AdminDashboardPage.tsx` and pass them as props.
3. Verification:
   - Run `npm run build` using run_command to verify Exit Code 0 and 0 errors.
   - Confirm line reduction from ~8,926 to ~7,700 lines.


## 2026-11-06T15:46:58Z
**Context**: Milestone 1 (ServicesManagementTab Extraction) Status Check
**Content**: Checking in on your current implementation status. Are you currently drafting `ServicesManagementTab.tsx` or modifying `AdminDashboardPage.tsx`? Please update your `progress.md` with your latest step.
**Action**: Reply with your current progress and update your `progress.md`.
