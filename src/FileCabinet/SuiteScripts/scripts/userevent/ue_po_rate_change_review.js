/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * - Consumes BYPASS_RATECHG_{poId} cache key (one-time bypass) at start of beforeSubmit
 * - Original behavior: detect new rates > item.purchaseprice, set proposed/orig/status and revert displayed rate
 * - beforeLoad: only show Review button when any pending line has purchaseprice < proposed
 */

define(['N/runtime', 'N/search', 'N/cache', 'N/ui/message', 'N/log'],
    function (runtime, search, cache, message, log) {

        const FIELDS = {
            BODY_HAS_PENDING: 'custbody_has_pending_ratechg',
            LINE_RATE: 'rate',
            LINE_ORIG: 'custcol_original_rate',
            LINE_PROP: 'custcol_proposed_rate',
            LINE_STATUS: 'custcol_ratechg_status'
        };

        const STATUS = { PENDING: 1, APPROVED: 2, REJECTED: 3 };
        const ALLOWED_CONTEXTS = [runtime.ContextType.SUITELET, runtime.ContextType.CSV_IMPORT];

        function isPendingApproval(poRec) {
            const val = poRec.getValue({ fieldId: 'approvalstatus' });
            return String(val || '') === '1';
        }

        function shouldBypassRateChange(poId) {
            if (!poId) return false;
            try {
                const c = cache.getCache({ name: 'ratechg_bypass', scope: cache.Scope.PRIVATE });
                const key = `BYPASS_RATECHG_${poId}`;
                const val = c.get({ key });
                if (val) {
                    try { c.remove({ key }); } catch (e) { /* ignore remove errors */ }
                    return true;
                }
            } catch (e) {
                log.debug('shouldBypassRateChange.error', e);
            }
            return false;
        }

        function chunkArray(arr, size) {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        }

        function fetchPurchasePrices(itemIdArray) {
            const map = {};
            if (!itemIdArray || itemIdArray.length === 0) return map;
            const CHUNK = 500;
            const chunks = chunkArray(itemIdArray, CHUNK);

            chunks.forEach(function (ids) {
                const itSearch = search.create({
                    type: search.Type.ITEM,
                    filters: [['internalid', 'anyof', ids]],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'cost' })
                    ]
                });
                itSearch.run().each(function (r) {
                    const id = r.getValue({ name: 'internalid' });
                    const price = r.getValue({ name: 'cost' });
                    map[String(id)] = (price === '' || price === null) ? 0 : Number(price);
                    return true;
                });
            });

            return map;
        }

        function beforeSubmit(ctx) {
            try {
                // Consume one-time bypass if present (very early)
                const newRec = ctx.newRecord;
                const poId = newRec && newRec.id;
                if (poId && shouldBypassRateChange(poId)) {
                    log.debug('beforeSubmit', 'Bypass detected, exiting rate-change beforeSubmit for PO ' + poId);
                    return;
                }

                // Only run in allowed contexts
                // if (ctx.type !== ctx.UserEventType.EDIT) return;
                if (!ALLOWED_CONTEXTS.includes(runtime.executionContext)) return;
                if (!isPendingApproval(newRec)) return;

                const lineCount = newRec.getLineCount({ sublistId: 'item' }) || 0;
                if (lineCount === 0) {
                    newRec.setValue({ fieldId: FIELDS.BODY_HAS_PENDING, value: false });
                    return;
                }

                // Build unique item ids
                const itemIdsSet = new Set();
                for (let i = 0; i < lineCount; i++) {
                    const existingStatus = Number(newRec.getSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_STATUS, line: i })) || 0;
                    if (existingStatus === STATUS.APPROVED || existingStatus === STATUS.REJECTED) continue;
                    const iid = newRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    if (iid) itemIdsSet.add(String(iid));
                }
                const priceMap = fetchPurchasePrices(Array.from(itemIdsSet));

                let hasPending = false;
                for (let i = 0; i < lineCount; i++) {
                    const existingStatus = Number(newRec.getSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_STATUS, line: i })) || 0;
                    if (existingStatus === STATUS.APPROVED || existingStatus === STATUS.REJECTED) continue;

                    const itemId = newRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    const masterPrice = Number(priceMap[String(itemId)] || 0);

                    const newRate = Number(newRec.getSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_RATE, line: i })) || 0;

                    if (newRate > masterPrice) {
                        hasPending = true;

                        newRec.setSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_PROP, line: i, value: newRate });
                        newRec.setSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_STATUS, line: i, value: STATUS.PENDING });

                        // revert displayed rate to purchase price
                        newRec.setSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_RATE, line: i, value: masterPrice });
                    }
                }

                newRec.setValue({ fieldId: FIELDS.BODY_HAS_PENDING, value: hasPending });
            } catch (e) {
                log.error({ title: 'rate-change.beforeSubmit error', details: e });
                throw e;
            }
        }

        function beforeLoad(ctx) {
            try {
                if (ctx.type !== ctx.UserEventType.VIEW) return;
                const rec = ctx.newRecord;
                if (!isPendingApproval(rec)) return;

                // gather pending lines
                const pending = [];
                const itemIdSet = new Set();
                const lineCount = rec.getLineCount({ sublistId: 'item' }) || 0;
                for (let i = 0; i < lineCount; i++) {
                    const st = Number(rec.getSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_STATUS, line: i })) || 0;
                    if (st !== STATUS.PENDING) continue;
                    const itemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    const proposed = Number(rec.getSublistValue({ sublistId: 'item', fieldId: FIELDS.LINE_PROP, line: i })) || 0;
                    pending.push({ line: i, itemId: itemId, proposed: proposed });
                    if (itemId) itemIdSet.add(String(itemId));
                }

                if (pending.length === 0) return;
                const priceMap = fetchPurchasePrices(Array.from(itemIdSet));
                let anyQualifies = false;
                for (let j = 0; j < pending.length; j++) {
                    const p = pending[j];
                    const purchasePrice = Number(priceMap[String(p.itemId)] || 0);
                    if (purchasePrice < Number(p.proposed || 0)) { anyQualifies = true; break; }
                }
                if (!anyQualifies) return;

                ctx.form.addPageInitMessage({
                    type: message.Type.WARNING,
                    title: 'Pending rate increases',
                    message: 'This PO has pending rate increases. Click "Review Rate Changes" to approve/reject them.'
                });

                ctx.form.clientScriptModulePath = '../client/cs_po_rate_change_review.js';
                ctx.form.addButton({
                    id: 'custpage_btn_review_rate_changes',
                    label: 'Review Rate Changes',
                    functionName: 'openRateChangeReview'
                });
            } catch (e) {
                // log but don't throw to avoid breaking UI
                log.error({ title: 'rate-change.beforeLoad error', details: e });
            }
        }

        return {
            beforeSubmit: beforeSubmit,
            beforeLoad: beforeLoad
        };
    });
