/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * - Applies per-line discount (custcol6) by updating 'rate' and recording 'custcol_beforediscount'
 * - Idempotent: skips lines already having custcol_beforediscount
 * - Sets BYPASS_RATECHG_{poId} cache key immediately before changing any rate so rate-change UE will skip once
 */

define(['N/runtime', 'N/cache', 'N/log'], function (runtime, cache, log) {

    function parsePercent(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Math.abs(value);
        var cleaned = String(value).trim().replace('%', '').trim();
        var n = Number(cleaned);
        return Number.isFinite(n) ? Math.abs(n) : null;
    }

    function setRateChgBypass(poId) {
        if (!poId) return;
        try {
            var c = cache.getCache({ name: 'ratechg_bypass', scope: cache.Scope.PRIVATE });
            c.put({ key: 'BYPASS_RATECHG_' + String(poId), value: 'T', ttl: 300 });
            log.debug('setRateChgBypass', 'Set BYPASS_RATECHG_' + String(poId));
        } catch (e) {
            log.debug('setRateChgBypass.error', e);
        }
    }

    // contexts allowed (per your requirement) — apply only for Suitelet and CSV import
    var ALLOWED_CONTEXTS = [runtime.ContextType.SUITELET, runtime.ContextType.CSV_IMPORT];

    function processSublist(objNewRecord, sublistId) {
        var lineCount = objNewRecord.getLineCount({ sublistId: sublistId }) || 0;
        if (lineCount === 0) return 0;

        var totalDiscount = 0;
        // determine poId if available (on update/edit) to set bypass
        var poId = objNewRecord.id || objNewRecord.getValue && objNewRecord.getValue({ fieldId: 'id' });

        var bypassSet = false;

        for (var i = 0; i < lineCount; i++) {
            try {
                // Skip if already processed (idempotency)
                var beforeVal = objNewRecord.getSublistValue({ sublistId: sublistId, fieldId: 'custcol_beforediscount', line: i });
                if (beforeVal !== null && beforeVal !== '' && beforeVal !== '0' && beforeVal !== 0 && typeof beforeVal !== 'undefined') {
                    continue;
                }

                var discountRaw = objNewRecord.getSublistValue({ sublistId: sublistId, fieldId: 'custcol6', line: i });
                var discountPct = parsePercent(discountRaw);
                if (discountPct === null) continue;

                var rateBefore = Number(objNewRecord.getSublistValue({ sublistId: sublistId, fieldId: 'rate', line: i })) || 0;
                var qty = Number(objNewRecord.getSublistValue({ sublistId: sublistId, fieldId: 'quantity', line: i })) || 0;
                var amountBeforeDisc = rateBefore * qty;
                var lineDiscount = +(amountBeforeDisc * (discountPct / 100)).toFixed(2);
                totalDiscount += lineDiscount;

                // mark before-discount for this line BEFORE mutating rate (idempotency)
                objNewRecord.setSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custcol_beforediscount',
                    line: i,
                    value: +amountBeforeDisc.toFixed(2)
                });

                // set bypass once per PO prior to changing rates
                if (!bypassSet && poId) {
                    setRateChgBypass(poId);
                    bypassSet = true;
                }

                var rateAfter = +(rateBefore * (1 - (discountPct / 100))).toFixed(2);

                objNewRecord.setSublistValue({
                    sublistId: sublistId,
                    fieldId: 'rate',
                    line: i,
                    value: rateAfter
                });
            } catch (inner) {
                log.debug({ title: 'processSublist.lineError', details: 'line: ' + i + ' err: ' + (inner && inner.message ? inner.message : inner) });
            }
        } // end loop

        log.debug({ title: 'processSublist.totalDiscount', details: totalDiscount });
        return totalDiscount;
    }

    function beforeSubmit(context) {
        try {
            // if (!ALLOWED_CONTEXTS.includes(runtime.executionContext)) return;
            // if (context.type !== context.UserEventType.EDIT) return;
            if (runtime.executionContext !== runtime.ContextType.CSV_IMPORT) return;

            var objNewRecord = context.newRecord;
            if (!objNewRecord) return;

            // If expense lines present, process expense, else process item lines
            if ((objNewRecord.getLineCount({ sublistId: 'expense' }) || 0) > 0) {
                processSublist(objNewRecord, 'expense');
            } else if ((objNewRecord.getLineCount({ sublistId: 'item' }) || 0) > 0) {
                processSublist(objNewRecord, 'item');
            }
        } catch (e) {
            log.error({ title: 'discount.beforeSubmit.error', details: e });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
