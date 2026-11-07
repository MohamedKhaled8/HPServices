## 2026-11-06T16:53:50Z
You are the Worker for Milestone 3 (Step 4 - Modularize Requests Tab).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\worker_m3/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project context and synthesis at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md
Read the 3 Explorer handoff reports:
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_1\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_2\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_3\handoff.md

FILE OWNERSHIP:
You have exclusive write ownership over:
- `src/components/admin/requests/` (create this directory and all components within it)
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
1. Create `src/components/admin/requests/` and populate it with clean, cohesive sub-components:
   - `AdminRequestsTab.tsx` (main coordinator tab)
   - `AdminRequestsToolbar.tsx` (title, count, search, sort reset, save layout, quick select buttons)
   - `AdminRequestsTable.tsx` (spreadsheet table grid, sticky headers, draggable data columns, status change action buttons, duplicate phone highlights, files badges, context menus)
   - `AdminRequestsBulkActions.tsx` (floating bulk actions bar)
   - `EditRequestModal.tsx` (edit request modal, lines 5614–5716)
   - `DocumentViewerModal.tsx` (attached receipts & files viewer sheet, lines 7190–7382)
   - `DefaultColumnsModal.tsx` (saved layouts & column history modal, lines 5136–5481)
   - `requestsHelpers.ts` (constants like `REQUEST_SPREADSHEET_STANDARD_KEYS`, `workflowStatusLabelAr`, `workflowStatusRank`, and status badge helpers)
   - Note: For assigned files viewer, reuse the existing `src/components/admin/modals/AssignedFilesViewerModal.tsx`.

2. Transfer all 40 functions and handlers verbatim with zero alteration of logic:
   - `handleStatusChange` (including WhatsApp notifications, Digital Transformation backend registration API with AES headers, and Electronic Payment automation queue)
   - `handleDeleteRequest`
   - `handleBulkStatusChange`, `handleBulkDelete`, `handleBulkDownloadZip`
   - `handleDownloadAll`
   - `handleExportRequestsToExcel`
   - `copyRequestsColumn`, `viewDocuments`
   - `handleRequestsSort`, `handleSaveLayout`, `handleLoadMoreServiceRequests`
   - Keyboard/mouse drag range listeners and auto-scroll handlers.

3. Update `src/page/AdminDashboardPage.tsx`:
   - Import `AdminRequestsTab` from `../components/admin/requests/AdminRequestsTab`.
   - Replace lines 3243–5524 (requests tab JSX) with `<AdminRequestsTab ... />`.
   - Remove lines 5614–5716 (Edit Request Modal, now inside `AdminRequestsTab`).
   - Remove lines 7067–7479 (Spreadsheet context menu, Cell menu, Document viewer sheet, Assigned files viewer, now encapsulated inside `AdminRequestsTab`).
   - Remove extracted action handlers from `AdminDashboardPage.tsx`: lines 1576–2282 (`handleStatusChange`, `handleDeleteRequest`, `handleBulkStatusChange`, `handleBulkDelete`, `handleBulkDownloadZip`, `handleDownloadAll`), lines 3075–3115, lines 3735–3779 (`handleExportRequestsToExcel`), lines 3786–3845 (selection handlers), and lines 686–872 (spreadsheet listeners).
   - CRITICAL RETENTION IN `AdminDashboardPage.tsx`:
     * Keep `serviceRequests`, `setServiceRequests` (shared with Assistant, Stats, Users).
     * Keep `selectedServiceId`, `setSelectedServiceId` (shared with `ServicesManagementTab`).
     * Keep `serviceTotalCounts`, `setServiceTotalCounts`.
     * Keep `translateKey`, `getServiceName`, `getStatusBadge` (used by `viewingStudentRequests` modal).
     * Keep `isEditingStudent` and `viewingStudentRequests` modals completely intact!

4. Verification:
   - Run `npm run build` using run_command to verify Exit Code 0 and 0 errors.
   - Run `npm test` using run_command.
   - Confirm substantial line reduction in `AdminDashboardPage.tsx` (dropping from 7,485 to ~4,200 lines).
