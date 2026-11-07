# Project: AdminDashboardPage Modularization (Steps 2-5)

## Architecture
- React + TypeScript + Firebase Firestore
- Extract large tab views and their associated state/sub-components out of the massive `AdminDashboardPage.tsx`
- Ensure zero loss of functions, zero alteration of logic
- Ensure lazy subscriptions where applicable to reduce DB queries

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Extract ServicesManagementTab | Move services management tab to `src/components/admin/configs/ServicesManagementTab.tsx` with all props/state/handlers intact | M1 | ORIGINAL_REQUEST |
| 2 | Extract ElectronicPaymentCodesTab | Move electronic payment codes tab to `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` | M2 | ORIGINAL_REQUEST |
| 3 | Modularize Requests Tab | Split massive requests tab into `src/components/admin/requests/AdminRequestsTab.tsx` and sub-components | M3 | ORIGINAL_REQUEST |
| 4 | Final Verification & Testing | Verify entire dashboard compilation, no functions missing, all tabs work cleanly | M4 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | ServicesManagementTab Extraction | Extract services tab & restore tools to `src/components/admin/configs/ServicesManagementTab.tsx`, keep all 22 restore/cleanup functions intact, lazy subscription | none | DONE |
| 2 | ElectronicPaymentCodesTab Extraction | Extract electronic payment codes tab to `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` (399 lines, lazy subscription) | M1 | DONE |
| 3 | AdminRequestsTab Modularization | Extract requests tab (~2,280 lines) into `src/components/admin/requests/AdminRequestsTab.tsx` and sub-components | M2 | DONE |
| 4 | Final Verification | Full project build verification, type checking, unit tests, and cross-tab regression check | M3 | DONE |

## Interface Contracts
### AdminDashboardPage ↔ ServicesManagementTab [DONE]
- Implemented in `src/components/admin/configs/ServicesManagementTab.tsx` (1,309 lines).

### AdminDashboardPage ↔ ElectronicPaymentCodesTab [DONE]
- Implemented in `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` (399 lines).

### AdminDashboardPage ↔ AdminRequestsTab [DONE]
- Implemented in `src/components/admin/requests/` (12 files, 4,944 lines).
- `AdminRequestsTab.tsx`, `AdminRequestsTable.tsx`, `AdminRequestsToolbar.tsx`, `AdminRequestsBulkActions.tsx`, `EditRequestModal.tsx`, `DocumentViewerModal.tsx`, `DefaultColumnsModal.tsx`, `requestsHelpersCore.ts`, `requestsHelpers.tsx`, `index.ts`.
- All 40 handlers preserved verbatim.

## Code Layout
- `src/page/AdminDashboardPage.tsx` (reduced from 8,926 to 3,340 lines, net reduction: -5,586 lines, 62.6% drop from Step 1 baseline; 66.8% drop from original 10,059 lines)
- `src/components/admin/configs/ServicesManagementTab.tsx` (1,309 lines)
- `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` (399 lines)
- `src/components/admin/requests/` (12 files, ~4,944 lines)
