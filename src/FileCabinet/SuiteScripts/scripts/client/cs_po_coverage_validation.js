/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * File:        ../client/cs_po_coverage_validation.js
 *
 * Responsibilities (client-side only):
 *   1. pageInit  – validates the logged-in user's role against custbody_po_approver_flag.
 *                  Hides the button if this user is not the assigned approver.
 *   2. openApprovalPopup (called by the button injected from UE beforeLoad) –
 *                  opens the Suitelet as a centered popup window.
 *
 * ⚙️  ROLE_MAP: map each approver name to its NetSuite Role internal ID.
 *     Customization → Users/Roles → Roles → open role → check URL for id=XXXX
 */

define(['N/runtime', 'N/log'],
    (runtime, log) => {

        // ─────────────────────────────────────────────────────────────
        // ⚙️  CONFIGURE: approver name → NetSuite Role internal ID
        // ─────────────────────────────────────────────────────────────
        const ROLE_MAP = {
            'CCO': '1001',  // ← replace with your actual CCO role ID
            'CED': '1002',  // ← replace with your actual CED role ID
            'BUH': '1003'   // ← replace with your actual BUH role ID
        };

        const BODY_APPROVER_FIELD = 'custbody_po_approver_flag';
        const BUTTON_ID = 'custpage_btn_approve_reject';

        const POPUP_WIDTH = 980;
        const POPUP_HEIGHT = 640;

        // ─────────────────────────────────────────────────────────────
        // pageInit – hide button if current user is not the approver
        // ─────────────────────────────────────────────────────────────
        const pageInit = (scriptContext) => {
            try {
                if (scriptContext.mode === 'create') return;

                const rec = scriptContext.currentRecord;
                const assignedRole = rec.getValue({ fieldId: BODY_APPROVER_FIELD });
                const expectedRoleId = ROLE_MAP[assignedRole];

                // If no mapping or user's role doesn't match → hide the button
                if (!expectedRoleId || String(runtime.getCurrentUser().role) !== String(expectedRoleId)) {
                    const btn = document.getElementById(BUTTON_ID);
                    if (btn) btn.style.display = 'none';
                }

            } catch (e) {
                alert('CS pageInit Error: ' + e.toString());
            }
        };

        // ─────────────────────────────────────────────────────────────
        // openApprovalPopup – called directly by the button's functionName
        // Parameters passed in by the UE beforeLoad when adding the button
        // ─────────────────────────────────────────────────────────────
        const openApprovalPopup = (poId, suiteletUrl) => {
            try {
                const url = `${suiteletUrl}&poId=${encodeURIComponent(poId)}`;
                const left = Math.max(0, Math.round((screen.width - POPUP_WIDTH) / 2));
                const top = Math.max(0, Math.round((screen.height - POPUP_HEIGHT) / 2));

                const popup = window.open(
                    url,
                    'po_approval_popup',
                    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},` +
                    `left=${left},top=${top},` +
                    `resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
                );

                if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                    alert('Popup was blocked. Please allow popups for NetSuite in your browser settings and try again.');
                }

            } catch (e) {
                alert('CS openApprovalPopup Error: ' + e.toString());
            }
        };

        return { pageInit, openApprovalPopup };
    });