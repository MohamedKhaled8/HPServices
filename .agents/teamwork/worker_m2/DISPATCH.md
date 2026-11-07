## 2026-11-06T16:11:46Z
You are the Worker for Milestone 2 (Step 3 - Extract ElectronicPaymentCodesTab).
Your working directory is: e:\Mt FlutterProject\hp_services\.agents\teamwork\worker_m2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project context and synthesis at:
e:\Mt FlutterProject\hp_services\.agents\teamwork\orchestrator\PROJECT.md
Read the 3 Explorer handoff reports:
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_1\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_2\handoff.md
- e:\Mt FlutterProject\hp_services\.agents\teamwork\explorer_m2_3\handoff.md

FILE OWNERSHIP:
You have exclusive write ownership over:
- `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` (to be created)
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
1. Create `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`:
   - Follow the template and interface contract documented in `explorer_m2_3/handoff.md` and `explorer_m2_1/handoff.md`.
   - Incorporate all 5 functions verbatim:
     * `toggleEPRow`
     * `toggleEPColumn`
     * `copyEPSelection`
     * `copyEPColumn`
     * `handleDeleteEPCode`
   - Include the table, search bar (`epSearchTerm`), column copy buttons, row flagging (`toggleFlag`), and delete actions.
   - Implement lazy on-demand Firestore subscription using `subscribeToElectronicPaymentCodes` on component mount, with cleanup (`unsubscribe()`) on unmount.
   - When new codes load in the listener, call `setEpCodes(loadedCodes)` if provided to keep parent state synchronized for `AdminAssistantTab` and `requests` lookups.
   - Dual export: `export const ElectronicPaymentCodesTab` and `export default ElectronicPaymentCodesTab`.

2. Update `src/page/AdminDashboardPage.tsx`:
   - Import `ElectronicPaymentCodesTab` from `../components/admin/codes/ElectronicPaymentCodesTab`.
   - Replace the JSX block at lines 6569–6765 with:
     ```tsx
     {activeTab === 'electronicPaymentCodes' && (
       <ElectronicPaymentCodesTab
         epCodes={epCodes}
         setEpCodes={setEpCodes}
         toggledFlags={toggledFlags}
         toggleFlag={toggleFlag}
         showAlert={showAlert}
         setToastState={setToastState}
         handleDeleteEPCode={handleDeleteEPCode}
         copyEPColumn={copyEPColumn}
       />
     )}
     ```
   - Remove the eager mount-time listener `unsubscribeEpCodes` from `useEffect` (lines 1486–1496 in current file).
   - Remove the tab-exclusive state variables from `AdminDashboardPage.tsx`:
     * `selectedEPRows`, `selectedEPColumns` (lines 254–255)
     * `epSearchTerm` (line 315)
   - Remove the local handlers from `AdminDashboardPage.tsx` that moved inside `ElectronicPaymentCodesTab`:
     * `toggleEPRow`, `toggleEPColumn` (lines 3014–3034)
     * `copyEPSelection` (lines 3060–3080)
   - CRITICAL PRESERVATION:
     * Keep `const [epCodes, setEpCodes] = useState<any[]>([]);` in `AdminDashboardPage.tsx` (consumed by `AdminAssistantTab` and `epCodesIndex`/`adminCodesLookup`).
     * Keep `epCodesIndex`, `adminCodesLookup`, and `enqueueElectronicPaymentAutomation` in `AdminDashboardPage.tsx`.
     * Keep all `dtCodes` and DT functions (`toggleDTRow`, `toggleDTColumn`, `copyDTSelection`, `copyDTColumn`, `handleDeleteDTCode`) untouched.

3. Verification:
   - Run `npm run build` using run_command to verify Exit Code 0 and 0 errors.
   - Confirm file line reduction in `AdminDashboardPage.tsx`.

Report results in:
`e:\Mt FlutterProject\hp_services\.agents\teamwork\worker_m2\handoff.md`
Update your `progress.md` regularly with liveness timestamps.
Send a message back when completed.


## 2026-11-06T16:23:06Z
**Context**: Server restart resume notice for Milestone 2 (Extract ElectronicPaymentCodesTab)
**Content**: The server restarted. Please resume work immediately on Milestone 2:
1. Create `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` following the exact template and contract from `explorer_m2_3/handoff.md` and `explorer_m2_1/handoff.md`.
2. Ensure all 5 functions (`toggleEPRow`, `toggleEPColumn`, `copyEPSelection`, `copyEPColumn`, `handleDeleteEPCode`) are implemented verbatim.
3. Wire lazy on-demand subscription for `subscribeToElectronicPaymentCodes` on mount with `return () => unsubscribe()` on unmount, calling `setEpCodes(loadedCodes)` to sync with parent.
4. Update `src/page/AdminDashboardPage.tsx`:
   - Import `ElectronicPaymentCodesTab`.
   - Replace lines 6569–6765 with `<ElectronicPaymentCodesTab ... />`.
   - Remove eager listener `unsubscribeEpCodes` from mount `useEffect` (lines 1486–1496).
   - Remove local `selectedEPRows`, `selectedEPColumns`, `epSearchTerm`, `toggleEPRow`, `toggleEPColumn`, `copyEPSelection`.
   - Keep `epCodes` state, `epCodesIndex`, `adminCodesLookup`, and `enqueueElectronicPaymentAutomation` in `AdminDashboardPage.tsx`.
   - Keep all DT functions untouched.
5. Run `npm run build` using run_command to verify Exit Code 0 and 0 errors.
6. Write handoff.md and report back.
**Action**: Execute the steps and send message upon completion.
