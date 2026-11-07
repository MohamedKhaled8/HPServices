## 2026-11-06T15:22:40Z
You are Explorer 3 for Milestone 1.
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_3/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read project context at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md

Task:
You are an explorer investigating Milestone 1: Extract `ServicesManagementTab` from `src/page/AdminDashboardPage.tsx` into `src/components/admin/configs/ServicesManagementTab.tsx`.
Inspect `src/page/AdminDashboardPage.tsx` (around lines 7000 to 8120, plus subscriptions and lifecycle effects).

Your specific focus:
1. Examine Firestore subscriptions and real-time listeners associated with services, settings, and configs. Identify if any listeners are currently active unconditionally at dashboard mount, and specify how to make them lazy on-demand (only subscribe when the services management tab is mounted/active).
2. Check existing config tabs (`BooksConfigTab.tsx`, `FeesConfigTab.tsx`, etc.) to see how lazy subscriptions and cleanup are implemented.
3. Formulate the exact TypeScript interface contract for `ServicesManagementTabProps`.
4. Outline the exact step-by-step diff/replacement plan for `AdminDashboardPage.tsx` and the newly created `src/components/admin/configs/ServicesManagementTab.tsx`.
5. Verify build command prerequisites (`npm run build`).

Do NOT modify any source files. You are strictly read-only.
Write your analysis and recommendations to:
`e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_3\handoff.md`
Update your `progress.md` with liveness timestamps.
Send a message back when completed.
