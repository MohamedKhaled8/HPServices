## 2026-11-06T16:00:49Z
You are Explorer 3 for Milestone 2 (Step 3 - Extract ElectronicPaymentCodesTab).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_3/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read project context at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md

Task:
You are an explorer investigating Milestone 2: Extract `ElectronicPaymentCodesTab` from `src/page/AdminDashboardPage.tsx` into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`.
Inspect `src/page/AdminDashboardPage.tsx` to locate:
1. Examine Firestore subscriptions and real-time listeners associated with electronic payment codes. Check if any listeners currently run at dashboard mount and specify how to convert them into lazy on-demand subscriptions inside `ElectronicPaymentCodesTab.tsx` (only subscribing when active, unsubscribing on unmount).
2. Check `src/components/admin/configs/ServicesManagementTab.tsx` and other config tabs for standard patterns.
3. Formulate the exact TypeScript interface contract for `ElectronicPaymentCodesTabProps`.
4. Outline the exact step-by-step diff/replacement plan for `AdminDashboardPage.tsx` and the newly created `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`.
5. Verify build command prerequisites (`npm run build`).

Do NOT modify any source files. You are strictly read-only.
Write your analysis and recommendations to:
`e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_3\handoff.md`
Update your `progress.md` with liveness timestamps.
Send a message back when completed.
