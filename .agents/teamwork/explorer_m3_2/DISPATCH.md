## 2026-11-06T16:41:01Z
You are Explorer 2 for Milestone 3 (Step 4 - Modularize Requests Tab).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read project context at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md

Task:
You are an explorer investigating Milestone 3: Modularize the massive requests tab (~2,280 lines) from `src/page/AdminDashboardPage.tsx` into `src/components/admin/requests/AdminRequestsTab.tsx` and sub-components.
Inspect `src/page/AdminDashboardPage.tsx` to locate:
1. Every single function, callback, handler, and database operation related to service requests:
   - Status updates (`handleStatusChange`, `updateRequestStatus`, bulk status updates).
   - Edit modal handling (`isEditingRequestModalOpen`, `handleSaveEditRequest`, field parsing).
   - Export functions (Excel, CSV, print, PDF).
   - Selection, filtering, sorting, and pagination handlers.
   - Cloudinary receipt viewing / document viewer integration.
2. User strict constraint: Do NOT delete any function, and do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها").
3. Catalog every function line-by-line so the worker will transfer them with 100% fidelity.
4. Detail which functions remain in `AdminDashboardPage.tsx` vs which move inside `AdminRequestsTab.tsx`.

Do NOT modify any source files. You are strictly read-only.
Write your analysis and recommendations to:
`e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_2\handoff.md`
Update your `progress.md` with liveness timestamps.
Send a message back when completed.
