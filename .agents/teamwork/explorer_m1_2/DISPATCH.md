## 2026-11-06T15:22:33Z
You are Explorer 2 for Milestone 1.
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read project context at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md

Task:
You are an explorer investigating Milestone 1: Extract `ServicesManagementTab` from `src/page/AdminDashboardPage.tsx` into `src/components/admin/configs/ServicesManagementTab.tsx`.
Inspect `src/page/AdminDashboardPage.tsx` (around lines 7000 to 8120, plus top-level handlers and modals).

Your specific focus:
1. Enumerate every single function, callback, handler, and database operation (Firestore queries, updates, deletes, restores, transactions) involved in services management, active toggling, reordering, fee config, and password-protected restore tools.
2. User strict constraint: Do NOT delete any function, and do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها").
3. Ensure every function is accounted for, line by line, so that nothing is accidentally dropped or modified during extraction.
4. Detail which functions will move inside `ServicesManagementTab.tsx` vs which functions remain in `AdminDashboardPage.tsx` (if any are shared by other tabs).

Do NOT modify any source files. You are strictly read-only.
Write your analysis and recommendations to:
`e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_2\handoff.md`
Update your `progress.md` with liveness timestamps.
Send a message back when completed.
