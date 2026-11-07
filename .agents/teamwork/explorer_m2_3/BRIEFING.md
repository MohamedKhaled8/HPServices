# BRIEFING — 2026-11-06T18:10:00Z

## Mission
Investigate extraction of `ElectronicPaymentCodesTab` from `src/page/AdminDashboardPage.tsx` into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` with lazy Firestore subscription, standard patterns, interface contracts, and replacement plan.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_3
- Original parent: 7b3074ca-47e5-4988-b52a-069ef82db078
- Milestone: Milestone 2 - Step 3: Extract ElectronicPaymentCodesTab

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify project source code
- Only write inside e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_3\
- Send final completion message via send_message to parent 7b3074ca-47e5-4988-b52a-069ef82db078

## Current Parent
- Conversation ID: 7b3074ca-47e5-4988-b52a-069ef82db078
- Updated: 2026-11-06T18:10:00Z

## Investigation State
- **Explored paths**:
  - `src/page/AdminDashboardPage.tsx` (lines 35-45, 250-285, 315, 476-486, 1430-1505, 1940-1980, 3014-3120, 3170-3177, 3271, 3549-3567, 4383-4396, 6565-6765)
  - `src/services/firebaseService.ts` (lines 4400-4505: saveElectronicPaymentCode, getElectronicPaymentCodes, subscribeToElectronicPaymentCodes, deleteElectronicPaymentCode)
  - `src/components/admin/configs/ServicesManagementTab.tsx` (M1 reference architecture for lazy subscriptions and props)
  - `src/components/admin/configs/FeesConfigTab.tsx`, `DigitalTransformationConfigTab.tsx`
  - `package.json` (build scripts)
- **Key findings**:
  - Located unconditional dashboard mount subscription in `AdminDashboardPage.tsx` lines 1486-1495 (`subscribeToElectronicPaymentCodes`).
  - Identified 5 verbatim functions to migrate: `copyEPColumn`, `copyEPSelection`, `toggleEPRow`, `toggleEPColumn`, `handleDeleteEPCode`.
  - Identified 3 exclusive state items: `epSearchTerm`, `selectedEPRows`, `selectedEPColumns`.
  - Identified cross-cutting state: `epCodes` is used by `epCodesIndex`, `adminCodesLookup`, `AdminAssistantTab`, and Service 4 column in requests table. Must keep `epCodes` / `setEpCodes` in `AdminDashboardPage.tsx` and pass to `ElectronicPaymentCodesTab`.
  - Build command verified: `npm run build` exits 0 with 0 errors in 19.65s; `npm test` passes 10/10 tests.
- **Unexplored areas**: None. All questions answered with empirical file lines and verification.

## Key Decisions Made
- `subscribeToElectronicPaymentCodes` will be converted to a lazy on-demand subscription inside `ElectronicPaymentCodesTab.tsx` that subscribes on mount and unsubscribes on unmount.
- `AdminDashboardPage.tsx` will pass `epCodes` and `setEpCodes` to maintain synchronization with `AdminAssistantTab` and requests table lookups.
- Full step-by-step diff and interface contract prepared for handoff report.

## Artifact Index
- DISPATCH.md — Recorded instructions
- progress.md — Heartbeat and progress tracking
- handoff.md — 5-Component handoff report
