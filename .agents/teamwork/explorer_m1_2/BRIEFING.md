# BRIEFING — 2026-11-06T17:32:00Z

## Mission
Investigate Milestone 1: Exhaustively catalog all functions, callbacks, handlers, and Firestore DB operations in `AdminDashboardPage.tsx` relating to services management, active toggling, reordering, fee config, and password-protected restore tools, ensuring zero functional deletion or alteration.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesis
- Working directory: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m1_2
- Original parent: 7b3074ca-47e5-4988-b52a-069ef82db078
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Strict user constraint: Do NOT delete any function, do NOT alter the functional behavior/logic of any function ("مش عايزك تمسح اي فانكشن او تعدل طريقه عمل اي فانكشن لان سابقا انت قمت بمسح ملفات مهمه واكواد مهمه لم استطع الرجوع لها")
- Enumerate every single function, callback, handler, and database operation line-by-line
- Determine exact migration destination (move to `ServicesManagementTab.tsx` vs keep in `AdminDashboardPage.tsx` if shared)

## Current Parent
- Conversation ID: 7b3074ca-47e5-4988-b52a-069ef82db078
- Updated: 2026-11-06T17:32:00Z

## Investigation State
- **Explored paths**:
  * `src/page/AdminDashboardPage.tsx` (lines 6264-7388, 2900-3780, 1255-1460, 330-360)
  * `src/components/admin/configs/DigitalTransformationConfigTab.tsx`
  * `src/components/admin/configs/FeesConfigTab.tsx`
  * Imports and paths in `src/config/firebase.ts`, `src/services/cloudinaryRestoreService.ts`, etc.
- **Key findings**:
  1. `activeTab === 'services'` is lines 6264-6781 (518 lines).
  2. Danger Zone Clean Password Modal is lines 6784-6868 (85 lines).
  3. Lines 6870-7388 contain 3 top-level modals (`isEditingRequestModalOpen`, `isEditingStudent`, `viewingStudentRequests`) that belong to `requests` and `users` tabs, NOT `services`. They MUST stay in `AdminDashboardPage.tsx`.
  4. 26 functions, 17 state variables, and 21 inline JSX handlers cataloged line-by-line.
  5. Cross-tab shared state identified: `adminPrefs` (passed as prop), `restoreToolsUnlocked` (kept in parent, passed as prop), `runAutoFixPlaceholderOrders` (kept in parent, passed as callback prop).
  6. Completely self-contained to `ServicesManagementTab.tsx`: `serviceSettings` (lazy subscription), `isServiceActive`, `getDisabledFields`, `moveServiceManual`, 22 restore/clean functions and Cloudinary operations.
- **Unexplored areas**: None for Milestone 1.

## Key Decisions Made
- Clear line-by-line division established between parent `AdminDashboardPage.tsx` and child `ServicesManagementTab.tsx`.
- Guaranteed 0 deleted functions and 0 altered behaviors.

## Artifact Index
- handoff.md — Final investigation handoff report
- progress.md — Liveness heartbeat
- BRIEFING.md — Situational awareness
- DISPATCH.md — Received directives
