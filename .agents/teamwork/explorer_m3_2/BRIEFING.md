# BRIEFING — 2026-11-06T16:50:00Z

## Mission
Catalog all functions, callbacks, handlers, modals, and database operations related to the service requests tab in `src/page/AdminDashboardPage.tsx` for Milestone 3 modularization into `src/components/admin/requests/AdminRequestsTab.tsx` and sub-components with 100% fidelity.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, code-analysis, synthesis
- Working directory: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m3_2
- Original parent: 7b3074ca-47e5-4988-b52a-069ef82db078
- Milestone: Milestone 3 (Step 4 - Modularize Requests Tab)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source files
- Strict user constraint: Do NOT delete any function, do NOT alter functional behavior/logic of any function
- Catalog every function line-by-line so worker transfers them with 100% fidelity
- Detail which functions remain in AdminDashboardPage.tsx vs which move inside AdminRequestsTab.tsx

## Current Parent
- Conversation ID: 7b3074ca-47e5-4988-b52a-069ef82db078
- Updated: 2026-11-06T16:50:00Z

## Investigation State
- **Explored paths**:
  - `src/page/AdminDashboardPage.tsx` (lines 1 to 7485)
  - `src/components/admin/configs/ServicesManagementTab.tsx` (lines 1 to 400)
  - `src/components/admin/modals/AssignedFilesViewerModal.tsx`
  - `src/utils/adminRequestsUtils.ts`
  - `src/utils/automationApi.ts`
- **Key findings**:
  - Baseline `npm run build` verified: Exit code 0, 0 errors.
  - Complete line-by-line catalog of all 40 functions, callbacks, effects, handlers, modals, and portals.
  - Line ranges identified:
    * Requests tab JSX: lines 3243 to 5524 (~2,282 lines).
    * Edit request modal: lines 5614 to 5715 (~101 lines).
    * Spreadsheet context menu: lines 7068 to 7134 (~66 lines).
    * Cell context menu: lines 7140 to 7188 (~48 lines).
    * Document viewer sheet portal: lines 7191 to 7382 (~192 lines).
    * Assigned files viewer portal: lines 7384 to 7479 (~95 lines).
    * Status updates & automations: lines 1576 to 1982 (~407 lines).
    * Bulk actions & exports: lines 1984 to 2281 (~298 lines).
    * Keyboard & mouse drag grid listeners: lines 686 to 870 (~185 lines).
    * Layout order & history persistence: lines 873 to 995 (~122 lines).
    * Filters & sorting memo: lines 2888 to 2964 (~77 lines).
    * Column copy & document viewer trigger: lines 3075 to 3106 (~32 lines).
  - Crucial shared state identified:
    * `serviceRequests`: shared with `AdminAssistantTab`, `AdminStatisticsTab`, and `requestCountByStudentId`.
    * `selectedServiceId` & `serviceTotalCounts`: passed to `ServicesManagementTab` which mutates them. Must remain in `AdminDashboardPage.tsx` and be passed as props.
    * `translateKey`, `getServiceName`, `getStatusBadge`: also used in `viewStudentRequests` modal outside requests tab. Must remain in `AdminDashboardPage.tsx` (and/or exported/passed).
- **Unexplored areas**: None, scope is fully mapped.

## Key Decisions Made
- Divide M3 requests component into clean modular architecture:
  1. `src/components/admin/requests/AdminRequestsTab.tsx`
  2. `src/components/admin/requests/EditRequestModal.tsx`
  3. `src/components/admin/requests/DocumentViewerModal.tsx`
  4. `src/components/admin/requests/AssignedFilesViewerModal.tsx`
  5. `src/components/admin/requests/DefaultColumnsModal.tsx`
  6. `src/components/admin/requests/RequestsBulkFloatingBar.tsx`

## Artifact Index
- handoff.md — Comprehensive handoff report for Worker M3
- progress.md — Liveness heartbeat
- BRIEFING.md — Persistent memory
- DISPATCH.md — Incoming parent instructions
