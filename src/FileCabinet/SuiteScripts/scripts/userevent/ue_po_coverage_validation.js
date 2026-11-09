/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Script:      ue_po_coverage_validation.js
 *
 * beforeLoad:  Adds the "Approve / Reject Lines" button if the PO has a
 *              pending approver role set (not empty, not Auto-Approve).
 *              Also attaches the Client Script to handle the button click.
 *
 * afterSubmit: On CREATE/EDIT:
 *              1. Auto-removes lines where custitem_inner_status ∉ {1, 2}
 *                 → If all lines removed: closes PO by setting isclosed=true per line
 *              2. Builds coverage map from saved search
 *              3. Stamps per-line custcol fields (cost flag, coverage flag, approver flag)
 *              4. Writes highest approver role to custbody_po_approver_flag (header)
 *
 * Custom Line Fields:
 *   custcol_po_cost_flag      – Text
 *   custcol_po_coverage_flag  – Text
 *   custcol_po_approver_flag  – Text
 *
 * Custom Header Field:
 *   custbody_po_approver_flag – Text (highest approver role: CCO / CED / BUH / Auto-Approve)
 */

define(['N/search', 'N/record', 'N/log', 'N/url', 'N/runtime'],
    (search, record, log, url, runtime) => {

        // ─────────────────────────────────────────────────────────────
        // CONSTANTS
        // ─────────────────────────────────────────────────────────────
        const BODY_APPROVER_FIELD = 'custbody_po_approver_flag';

        const LINE_COST_FLAG = 'custcol_po_cost_flag';
        const LINE_COV_FLAG = 'custcol_po_coverage_flag';
        const LINE_APPROVER_FLAG = 'custcol_po_approver_flag';

        const ALLOWED_INNER_STATUS = ['1', '2']; // 1 = Regular, 2 = Sample

        const COST_FLAGS = ['Matching', 'Minor Variance', 'Significant Variance', 'Critical Variance'];
        const COV_FLAGS = ['Matching', 'Slight Excess', 'Moderate Excess', 'Critical Excess'];
        const APPROVER_RANK = ['Auto-Approve', 'BUH', 'CED', 'CCO'];

        // Suitelet identifiers
        const SUITELET_SCRIPT_ID = 'customscript_sl_po_coverage_validation';
        const SUITELET_DEPLOY_ID = 'customdeploy_sl_po_coverage_validation';

        // Client Script path (attached via beforeLoad for button wiring)
        const CLIENT_SCRIPT_PATH = '../client/cs_po_coverage_validation.js';

        // ─────────────────────────────────────────────────────────────
        // BEFORE LOAD – Add button if this PO requires approval
        // ─────────────────────────────────────────────────────────────
        const beforeLoad = (context) => {
            // Only in View mode (Edit mode uses same form but button is action-oriented)
            if (context.type !== context.UserEventType.VIEW) return;

            try {
                const rec = context.newRecord;
                const assignedApprover = rec.getValue({ fieldId: BODY_APPROVER_FIELD });

                log.debug({
                    title: 'beforeLoad – Approver Check',
                    details: `PO ${rec.id} | assignedApprover="${assignedApprover}"`
                });

                // Only show button when PO has a 'Pending X approval' status
                // Values: 'Pending CCO approval' | 'Pending CED approval' | 'Pending BUH approval'
                // No button for: empty | 'Auto Approved' | 'Approved by X'
                if (!assignedApprover || !assignedApprover.startsWith('Pending')) return;

                // Build the Suitelet URL to pass into the CS as a parameter
                const suiteletUrl = url.resolveScript({
                    scriptId: SUITELET_SCRIPT_ID,
                    deploymentId: SUITELET_DEPLOY_ID,
                    returnExternalUrl: false
                });

                // Attach Client Script — this is what wires up the button click handler
                context.form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

                // Add the button — the CS pageInit will show/hide it based on user role
                context.form.addButton({
                    id: 'custpage_btn_approve_reject',
                    label: 'Approve / Reject Lines',
                    functionName: `openApprovalPopup('${rec.id}', '${suiteletUrl}')`
                });

                log.debug({
                    title: 'beforeLoad – Button Added',
                    details: `Button added for approver "${assignedApprover}" on PO ${rec.id}`
                });

            } catch (e) {
                log.error({ title: 'beforeLoad Error', details: e.toString() });
            }
        };

        // ─────────────────────────────────────────────────────────────
        // AFTER SUBMIT – Validation, stamping, auto-close
        // ─────────────────────────────────────────────────────────────
        const afterSubmit = (context) => {
            const allowedTypes = [
                context.UserEventType.CREATE,
                // context.UserEventType.EDIT,
                runtime.ContextType.SUITELET,
                runtime.ContextType.CSV_IMPORT
            ];
            if (!allowedTypes.includes(context.type)) return;

            const poId = context.newRecord.id;
            log.debug({ title: 'afterSubmit – Start', details: `PO ID: ${poId}` });

            try {
                const poRec = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: poId,
                    isDynamic: true
                });

                // Step 1: Auto-remove disallowed inner-status lines
                const removedCount = removeDisallowedLines(poRec);
                const remainingLines = poRec.getLineCount({ sublistId: 'item' });

                log.debug({
                    title: 'afterSubmit – Line Count',
                    details: `Removed: ${removedCount} | Remaining: ${remainingLines}`
                });

                // All lines removed → close the PO by reloading original and setting isclosed per line
                if (remainingLines === 0) {
                    closePO(poId);
                    return;
                }

                // Step 2: Build coverage map
                const coverageMap = buildCoverageMap(poId);
                log.debug({ title: 'Coverage Map', details: JSON.stringify(coverageMap) });

                // Step 3: Stamp per-line flags and get highest approver
                const worstApprover = evaluateAndStampLines(poRec, coverageMap);

                // Step 4: Write approver flag to header in 'Pending X approval' format
                const approverFlagValue = worstApprover === 'Auto-Approve'
                    ? 'Auto Approved'
                    : `Pending ${worstApprover} approval`;
                poRec.setValue({ fieldId: BODY_APPROVER_FIELD, value: approverFlagValue });

                // Step 5: Save
                poRec.save({ enableSourcing: false, ignoreMandatoryFields: true });

                log.audit({
                    title: 'afterSubmit – Complete',
                    details: `PO ${poId} → Approver: ${worstApprover} | Lines: ${remainingLines}`
                });

            } catch (e) {
                log.error({ title: 'afterSubmit Error', details: e.toString() });
            }
        };

        // ─────────────────────────────────────────────────────────────
        // Close PO: reload original record, set isclosed=true per line
        // ─────────────────────────────────────────────────────────────
        const closePO = (poId) => {
            const poRecToClose = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: true
            });

            const totalLines = poRecToClose.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < totalLines; i++) {
                poRecToClose.selectLine({ sublistId: 'item', line: i });
                poRecToClose.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true });
                poRecToClose.commitLine({ sublistId: 'item' });
            }

            poRecToClose.save({ enableSourcing: false, ignoreMandatoryFields: true });

            log.audit({
                title: 'PO Auto-Closed',
                details: `PO ${poId} – all ${totalLines} line(s) closed (isclosed=true)`
            });
        };

        // ─────────────────────────────────────────────────────────────
        // Remove lines with disallowed inner status (reverse iteration)
        // Returns count of removed lines
        // ─────────────────────────────────────────────────────────────
        const removeDisallowedLines = (poRec) => {
            const lineCount = poRec.getLineCount({ sublistId: 'item' });
            let removed = 0;

            for (let i = lineCount - 1; i >= 0; i--) {
                const itemId = poRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });

                const innerStatusResult = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['custitem_inner_status']
                });

                // lookupFields returns list fields as array of {value, text} objects
                const innerStatusArr = innerStatusResult.custitem_inner_status;
                const innerStatus = Array.isArray(innerStatusArr) && innerStatusArr.length
                    ? String(innerStatusArr[0].value)
                    : '';

                log.debug({
                    title: `Line ${i} – Inner Status`,
                    details: `Item ${itemId} → innerStatus="${innerStatus}"`
                });

                if (!ALLOWED_INNER_STATUS.includes(innerStatus)) {
                    poRec.removeLine({ sublistId: 'item', line: i });
                    removed++;
                }
            }

            return removed;
        };

        // ─────────────────────────────────────────────────────────────
        // Build coverage map using two searches:
        //
        //   Search A (scoped to THIS PO):
        //     – poQty        = SUM(quantity) on this PO per item
        //     – stockOnHand  = MAX(item.quantityonhand)
        //     – avgDailyFcst = MAX(item.custitem_average_daily_forecast)
        //     – maxCoverage  = MAX(item.custitem_max_coverage)
        //
        //   Search B (ALL pending receipt POs, status PurchOrd:B, same item/location scope):
        //     – pendingReceipts = SUM(quantity) across all pending POs per item
        //
        //   Derived values per item:
        //     currentPrDoc  = (stockOnHand + pendingReceipts) / avgDailyFcst
        //     remainingDoc  = CEIL(maxCoverage - currentPrDoc), floor 0
        //     poDoc         = poQty / avgDailyFcst
        //     variance      = poDoc - remainingDoc  (positive = overpurchase/excess)
        //     covFlag       = derived from variance thresholds
        //
        // Returns: { itemId: { poQty, stockOnHand, pendingReceipts, avgDailyFcst,
        //                      maxCoverage, currentPrDoc, remainingDoc, poDoc,
        //                      variance, covFlag } }
        // ─────────────────────────────────────────────────────────────
        const buildCoverageMap = (poId) => {
            const map = {};

            // ── Search A: this PO's lines ──────────────────────────────
            const searchA = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['type', 'anyof', 'PurchOrd'], 'AND',
                    ['internalid', 'anyof', poId], 'AND',
                    ['mainline', 'is', 'F'], 'AND',
                    ['item.type', 'anyof', 'InvtPart'], 'AND',
                    ['item.custitem_required_doc', 'isnotempty', ''], 'AND',
                    ['item.custitem_max_coverage', 'isnotempty', '']
                ],
                columns: [
                    search.createColumn({ name: 'item', summary: 'GROUP' }),
                    search.createColumn({ name: 'quantity', summary: 'SUM', label: 'POQty' }),
                    search.createColumn({ name: 'quantityonhand', join: 'item', summary: 'MAX', label: 'SOH' }),
                    search.createColumn({ name: 'custitem_average_daily_forecast', join: 'item', summary: 'MAX', label: 'ADF' }),
                    search.createColumn({ name: 'custitem_max_coverage', join: 'item', summary: 'MAX', label: 'MaxCov' })
                ]
            });

            searchA.run().each((result) => {
                const itemId = String(result.getValue({ name: 'item', summary: 'GROUP' }));
                map[itemId] = {
                    poQty: parseFloat(result.getValue({ name: 'quantity', summary: 'SUM' })) || 0,
                    stockOnHand: parseFloat(result.getValue({ name: 'quantityonhand', join: 'item', summary: 'MAX' })) || 0,
                    avgDailyFcst: parseFloat(result.getValue({ name: 'custitem_average_daily_forecast', join: 'item', summary: 'MAX' })) || 0,
                    maxCoverage: parseFloat(result.getValue({ name: 'custitem_max_coverage', join: 'item', summary: 'MAX' })) || 0,
                    pendingReceipts: 0  // filled by Search B (other PurchOrd:B POs)
                };
                return true;
            });

            if (!Object.keys(map).length) return map; // no matching lines

            // ── Search B: ALL pending receipt POs for these items ──────
            // Filter to the same item set found in Search A
            const itemIds = Object.keys(map);

            const searchB = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['type', 'anyof', 'PurchOrd'], 'AND',
                    ['mainline', 'is', 'F'], 'AND',
                    ['status', 'anyof', 'PurchOrd:B'], 'AND',  // Pending Receipt
                    ['item.type', 'anyof', 'InvtPart'], 'AND',
                    ['item', 'anyof', ...itemIds], 'AND',
                    ['item.inventorylocation', 'anyof', '203', '206'], 'AND',
                    ['item.locationquantityonhand', 'greaterthan', '0']
                ],
                columns: [
                    search.createColumn({ name: 'item', summary: 'GROUP' }),
                    search.createColumn({ name: 'quantity', summary: 'SUM', label: 'PendingQty' })
                ]
            });

            searchB.run().each((result) => {
                const itemId = String(result.getValue({ name: 'item', summary: 'GROUP' }));
                const pendingQty = parseFloat(result.getValue({ name: 'quantity', summary: 'SUM' })) || 0;
                if (map[itemId]) map[itemId].pendingReceipts = pendingQty;
                return true;
            });

            // ── Derive DOC values and coverage flag for each item ──────
            Object.keys(map).forEach((itemId) => {
                const d = map[itemId];
                const adf = d.avgDailyFcst;

                if (!adf || adf === 0) {
                    d.currentPrDoc = 0;
                    d.remainingDoc = 0;
                    d.poDoc = 0;
                    d.variance = 0;
                    d.covFlag = 'Matching';
                    return;
                }

                // (3) Current + PR DOC = (SOH + PR) / ADF
                //     PR = total pending receipt qty from ALL existing PurchOrd:B POs (Search B)
                //     The current PO qty is intentionally excluded here — it becomes PO DOC separately
                d.currentPrDoc = (d.stockOnHand + d.pendingReceipts) / adf;

                // (4) Remaining DOC = CEIL(MaxCoverage - Current+PR DOC), floor 0
                //     Represents how many days of coverage space is still available
                d.remainingDoc = Math.max(Math.ceil(d.maxCoverage - d.currentPrDoc), 0);

                // (5) PO DOC = this PO's quantity / ADF
                //     How many days of coverage this PO order adds
                d.poDoc = d.poQty / adf;

                // (6) Coverage Variance = PO DOC - Remaining DOC
                //     Negative/zero = within coverage (Matching)
                //     Positive      = overpurchase — how many days beyond remaining capacity
                d.variance = d.poDoc - d.remainingDoc;

                // Coverage flag from variance
                d.covFlag = computeCoverageFlag(d.variance);

                log.debug({
                    title: `Coverage Map – Item ${itemId}`,
                    details: `SOH=${d.stockOnHand}, PR=${d.pendingReceipts}, ADF=${adf}, ` +
                        `maxCov=${d.maxCoverage}, currentPrDoc=${d.currentPrDoc.toFixed(2)}, ` +
                        `remainingDoc=${d.remainingDoc}, poQty=${d.poQty}, poDoc=${d.poDoc.toFixed(2)}, ` +
                        `variance=${d.variance.toFixed(2)}, covFlag=${d.covFlag}`
                });
            });

            return map;
        };

        // ─────────────────────────────────────────────────────────────
        // Coverage flag from variance (PO DOC - Remaining DOC)
        // Negative/zero = within coverage target → Matching
        // Positive      = overpurchase, thresholds in days
        // ─────────────────────────────────────────────────────────────
        const computeCoverageFlag = (variance) => {
            if (variance <= 0) return 'Matching';        // PO DOC within remaining capacity
            if (variance <= 7) return 'Slight Excess';   // up to 7 days over
            if (variance <= 30) return 'Moderate Excess'; // 7–30 days over
            return 'Critical Excess';                      // > 30 days over
        };

        // ─────────────────────────────────────────────────────────────
        // Evaluate each line, stamp custcol fields,
        // return the highest approver role across all lines
        // ─────────────────────────────────────────────────────────────
        const evaluateAndStampLines = (poRec, coverageMap) => {
            let worstApproverIdx = 0;
            const lineCount = poRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const itemType = poRec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
                if (itemType !== 'InvtPart') continue;

                const itemId = String(poRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }));
                const unitCost = parseFloat(poRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })) || 0;

                const itemFields = search.lookupFields({ type: search.Type.ITEM, id: itemId, columns: ['lastpurchaseprice'] });
                const referenceCost = parseFloat(itemFields.lastpurchaseprice) || 0;

                const costFlag = computeCostFlag(unitCost, referenceCost);
                const itemDoc = coverageMap[itemId] || {};
                const covFlag = itemDoc.covFlag || 'Matching';

                const lineApprover = determineApprover(costFlag, covFlag);
                const lineApproverIdx = APPROVER_RANK.indexOf(lineApprover);
                if (lineApproverIdx > worstApproverIdx) worstApproverIdx = lineApproverIdx;

                poRec.selectLine({ sublistId: 'item', line: i });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: LINE_COST_FLAG, value: costFlag });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: LINE_COV_FLAG, value: covFlag });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: LINE_APPROVER_FLAG, value: lineApprover });
                poRec.commitLine({ sublistId: 'item' });

                log.debug({
                    title: `Line ${i} – Item ${itemId}`,
                    details: `rate=${unitCost}, ref=${referenceCost}, costFlag=${costFlag} | ` +
                        `remainingDoc=${itemDoc.remainingDoc}, poDoc=${(itemDoc.poDoc || 0).toFixed(2)}, ` +
                        `variance=${(itemDoc.variance || 0).toFixed(2)}, covFlag=${covFlag}, approver=${lineApprover}`
                });
            }

            return APPROVER_RANK[worstApproverIdx];
        };

        // ─────────────────────────────────────────────────────────────
        // Cost Flag computation
        // ─────────────────────────────────────────────────────────────
        const computeCostFlag = (unitCost, referenceCost) => {
            if (!referenceCost || referenceCost === 0) return 'Matching';
            const pct = (unitCost / referenceCost) * 100;
            if (pct <= 100) return 'Matching';
            if (pct <= 115) return 'Minor Variance';
            if (pct <= 130) return 'Significant Variance';
            return 'Critical Variance';
        };

        // ─────────────────────────────────────────────────────────────
        // Approver determination (OR logic, top-down)
        // ─────────────────────────────────────────────────────────────
        const determineApprover = (costFlag, covFlag) => {
            if (costFlag === 'Critical Variance' || covFlag === 'Critical Excess') return 'CCO';
            if (costFlag === 'Significant Variance' || covFlag === 'Moderate Excess') return 'CED';
            if (costFlag === 'Minor Variance' || covFlag === 'Slight Excess') return 'BUH';
            return 'Auto-Approve';
        };

        return { beforeLoad, afterSubmit };
    });