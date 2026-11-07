# BRIEFING — 2026-11-06T16:01:00Z

## Mission
Investigate and produce extraction specification for `ElectronicPaymentCodesTab` from `src/page/AdminDashboardPage.tsx` into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` without deleting or altering any function behavior.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_1\
- Original parent: 7b3074ca-47e5-4988-b52a-069ef82db078
- Milestone: Milestone 2 (Step 3 - Extract ElectronicPaymentCodesTab)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify source code
- Do NOT delete any function
- Do NOT alter functional behavior or logic
- Document line boundaries, state, handlers, cross-tab dependencies, interface contract

## Current Parent
- Conversation ID: 7b3074ca-47e5-4988-b52a-069ef82db078
- Updated: not yet

## Investigation State
- **Explored paths**: `src/page/AdminDashboardPage.tsx`, `src/components/admin/codes/`, `src/types/index.ts`, `src/services/firebaseService.ts`, `src/constants/adminNavigation.ts`
- **Key findings**:
  - Exact JSX line boundaries for `electronicPaymentCodes` tab: lines 6569–6765 (197 lines).
  - State: `epCodes`, `epSearchTerm`, `selectedEPRows`, `selectedEPColumns`.
  - Shared dependencies: `epCodes` is consumed by `AdminAssistantTab` (line 3271) and `requests` tab columns via `epCodesIndex` and `adminCodesLookup` (lines 3554, 4384).
  - Eager listener on mount at line 1486 can be replaced with on-demand lazy subscription inside `ElectronicPaymentCodesTab.tsx`.
  - Zero functions need to be deleted from `AdminDashboardPage.tsx`. All existing handlers (`copyEPColumn`, `handleDeleteEPCode`, `toggleEPRow`, `toggleEPColumn`, `copyEPSelection`) will be preserved.
  - Baseline `npm run build` verified with Exit Code 0 and 0 errors.
- **Unexplored areas**: None for Milestone 2.

## Key Decisions Made
- `epCodes` state remains in `AdminDashboardPage.tsx` and is passed as props to avoid breaking `AdminAssistantTab` and requests tab lookups.
- `ElectronicPaymentCodesTab` will be created in `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`.
- Realtime listener will run lazily upon mount inside `ElectronicPaymentCodesTab` and unsubscribe on unmount, updating `setEpCodes`.

## Artifact Index
- `handoff.md` — Final extraction plan and investigation report
- `progress.md` — Liveness heartbeat and step tracking
- `DISPATCH.md` — Incoming task prompt record

