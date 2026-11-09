/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * Deploy on:
 *   - Transfer Order       (CREATE, EDIT, CSV)
 *   - Inventory Transfer   (CREATE, EDIT, CSV)
 *   - Item Receipt         (CREATE, EDIT, CSV)
 *   - Item Fulfillment     (CREATE, EDIT, CSV)
 *
 * Rules
 *   1. Administrator (role 3) can do anything.
 *   2. Everyone else:
 *      - TO / IT : blocked if From or To is a restricted location,
 *                  unless (From, To) is an allowed exception route.
 *      - IR      : blocked if a received line's To location is restricted,
 *                  unless (originating TO From, line To) is an exception.
 *      - IF      : blocked if a fulfilled line's From location OR the header
 *                  To location is restricted, unless (line From, header To)
 *                  is an exception.
 */
define(['N/record', 'N/runtime', 'N/search', 'N/error'], function (record, runtime, search, error) {

    /* ================================================================
     * Configuration
     * ================================================================ */

    const BLOCKED_LOCATION_IDS = [261, 317, 285];
    // const BLOCKED_LOCATION_IDS = [246, 236, 249]; // SB sample

    /** (From -> To[]) routes allowed for all roles. */
    const ALLOWED_ROUTE_EXCEPTIONS = [
        { from: 262, to: [285, 261] },
        { from: 312, to: [285, 261] }
    ];
    /* const ALLOWED_ROUTE_EXCEPTIONS = [ // SB sample
        { from: 2, to: [246, 249] },
        { from: 3, to: [246, 249] }
    ]; */

    const EXEMPT_ROLE_IDS = [3]; // Administrator

    const HDR_FROM_FIELD = 'location';
    const HDR_TO_FIELD = 'transferlocation';
    const LINE_SUBLIST = 'item';
    const LINE_LOCATION_FIELD = 'location';
    const LINE_APPLY_FIELD = 'itemreceive'; // "Receive" / "Fulfill" checkbox
    const CREATED_FROM_FIELD = 'createdfrom';

    /* ================================================================
     * Entry point
     * ================================================================ */

    function beforeSubmit(context) {
        const isCreateOrEdit =
            context.type === context.UserEventType.CREATE ||
            context.type === context.UserEventType.EDIT;
        const isCsv = runtime.executionContext === runtime.ContextType.CSV_IMPORT;

        if (!isCreateOrEdit && !isCsv) return;
        if (isCurrentUserExempt()) return;

        switch (context.newRecord.type) {
            case record.Type.TRANSFER_ORDER:
            case record.Type.INVENTORY_TRANSFER:
                handleHeaderLevel(context);
                break;
            case record.Type.ITEM_RECEIPT:
                handleLines(context, 'receipt');
                break;
            case record.Type.ITEM_FULFILLMENT:
                handleLines(context, 'fulfillment');
                break;
        }
    }

    /* ================================================================
     * TO / IT — header level
     * ================================================================ */

    function handleHeaderLevel(context) {
        const rec = context.newRecord;

        if (context.type === context.UserEventType.EDIT) {
            const fromChanged = String(rec.getValue(HDR_FROM_FIELD)) !== String(context.oldRecord.getValue(HDR_FROM_FIELD));
            const toChanged = String(rec.getValue(HDR_TO_FIELD)) !== String(context.oldRecord.getValue(HDR_TO_FIELD));
            if (!fromChanged && !toChanged) return;
        }

        const fromId = rec.getValue(HDR_FROM_FIELD);
        const toId = rec.getValue(HDR_TO_FIELD);

        if (isAllowedException(fromId, toId)) return;

        const fromBlocked = isBlocked(fromId);
        const toBlocked = isBlocked(toId);
        if (!fromBlocked && !toBlocked) return;

        fail(`${prettyType(rec.type)} from "${getLocationName(fromId) || '(unknown)'}" (ID: ${fromId}) ` +
            `to "${getLocationName(toId) || '(unknown)'}" (ID: ${toId}) is not allowed. ` +
            `Reason(s): ${buildReasons(fromBlocked, toBlocked)}. ` +
            `Restricted locations: ${buildBlockedText()}. ` +
            `Allowed exception(s): ${buildExceptionText()}.`);
    }

    /* ================================================================
     * IR / IF — line level (ALL applied lines are checked, not just line 0)
     *   IR: line location = To   -> From comes from the originating TO
     *   IF: line location = From -> To   comes from the originating TO
     * ================================================================ */

    function handleLines(context, kind) {
        const rec = context.newRecord;
        const lineCount = rec.getLineCount({ sublistId: LINE_SUBLIST });
        if (lineCount <= 0) return;

        // Originating TO header values (one lookup, only if needed)
        let origin = null;
        const getOrigin = () => {
            if (origin === null) origin = getOriginTOLocations(rec);
            return origin;
        };

        for (let i = 0; i < lineCount; i++) {
            // Ignore lines that are not being received / fulfilled
            const applied = rec.getSublistValue({ sublistId: LINE_SUBLIST, fieldId: LINE_APPLY_FIELD, line: i });
            if (applied === false || applied === 'F') continue;

            const lineLocId = rec.getSublistValue({
                sublistId: LINE_SUBLIST,
                fieldId: LINE_LOCATION_FIELD,
                line: i
            });

            if (kind === 'receipt') {
                // IR: line location = To, From comes from the originating TO
                if (!isBlocked(lineLocId)) continue; // cheap check first, no lookup

                if (isAllowedException(getOrigin().from, lineLocId)) continue;

                fail(`Item Receipt with a restricted "To" location is not allowed ` +
                    `(line ${i + 1}). Location: "${getLocationName(lineLocId) || '(unknown)'}" (ID: ${lineLocId}). ` +
                    `Restricted locations: ${buildBlockedText()}. ` +
                    `Allowed exception(s): ${buildExceptionText()}.`);
            } else {
                // IF: line location = From, To is the header "transferlocation"
                // (falls back to the originating TO if the header value is empty)
                let toId = rec.getValue(HDR_TO_FIELD);
                if (isEmpty(toId)) toId = getOrigin().to;

                const fromBlocked = isBlocked(lineLocId);
                const toBlocked = isBlocked(toId);
                if (!fromBlocked && !toBlocked) continue;

                if (isAllowedException(lineLocId, toId)) continue;

                fail(`Item Fulfillment from "${getLocationName(lineLocId) || '(unknown)'}" (ID: ${lineLocId}) ` +
                    `to "${getLocationName(toId) || '(unknown)'}" (ID: ${toId}) is not allowed ` +
                    `(line ${i + 1}). Reason(s): ${buildReasons(fromBlocked, toBlocked)}. ` +
                    `Restricted locations: ${buildBlockedText()}. ` +
                    `Allowed exception(s): ${buildExceptionText()}.`);
            }
        }
    }

    /** From/To of the originating Transfer Order (nulls if none). */
    function getOriginTOLocations(rec) {
        const result = { from: null, to: null };
        let originId = null;
        try {
            originId = rec.getValue(CREATED_FROM_FIELD);
        } catch (e) {
            return result;
        }
        if (isEmpty(originId)) return result;

        try {
            const v = search.lookupFields({
                type: search.Type.TRANSFER_ORDER,
                id: originId,
                columns: [HDR_FROM_FIELD, HDR_TO_FIELD]
            });
            result.from = v[HDR_FROM_FIELD] && v[HDR_FROM_FIELD][0] ? v[HDR_FROM_FIELD][0].value : null;
            result.to = v[HDR_TO_FIELD] && v[HDR_TO_FIELD][0] ? v[HDR_TO_FIELD][0].value : null;
        } catch (e) {
            // createdfrom is not a Transfer Order (PO, RMA, ...) -> leave nulls
        }
        return result;
    }

    /* ================================================================
     * Core checks
     * ================================================================ */

    function isAllowedException(fromId, toId) {
        if (isEmpty(fromId) || isEmpty(toId)) return false;
        const f = Number(fromId);
        const t = Number(toId);
        return ALLOWED_ROUTE_EXCEPTIONS.some(r =>
            Number(r.from) === f && r.to.map(Number).indexOf(t) !== -1);
    }

    function isBlocked(locationId) {
        return !isEmpty(locationId) && BLOCKED_LOCATION_IDS.indexOf(Number(locationId)) !== -1;
    }

    function isCurrentUserExempt() {
        return EXEMPT_ROLE_IDS.indexOf(Number(runtime.getCurrentUser().role)) !== -1;
    }

    /* ================================================================
     * Messages / helpers
     * ================================================================ */

    function fail(message) {
        throw error.create({
            name: 'RESTRICTED_LOCATION',
            message: message,
            notifyOff: true
        });
    }

    function prettyType(type) {
        switch (type) {
            case record.Type.TRANSFER_ORDER: return 'Transfer Order';
            case record.Type.INVENTORY_TRANSFER: return 'Inventory Transfer';
            case record.Type.ITEM_RECEIPT: return 'Item Receipt';
            case record.Type.ITEM_FULFILLMENT: return 'Item Fulfillment';
            default: return 'Record';
        }
    }

    function buildReasons(fromBlocked, toBlocked) {
        const r = [];
        if (fromBlocked) r.push('"From" location is restricted');
        if (toBlocked) r.push('"To" location is restricted');
        return r.join('; ');
    }

    function buildBlockedText() {
        return BLOCKED_LOCATION_IDS.map(id => `${getLocationName(id) || id} (${id})`).join(', ');
    }

    function buildExceptionText() {
        return ALLOWED_ROUTE_EXCEPTIONS.map(r => {
            const toLabels = r.to.map(id => getLocationName(id) || id).join(' or ');
            return `From "${getLocationName(r.from) || r.from}" (${r.from}) to "${toLabels}"`;
        }).join('; ');
    }

    /** Best-effort location name (lightweight lookup, error path only). */
    function getLocationName(locationId) {
        if (isEmpty(locationId)) return null;
        try {
            return search.lookupFields({
                type: search.Type.LOCATION,
                id: locationId,
                columns: ['name']
            }).name || null;
        } catch (e) {
            return null;
        }
    }

    function isEmpty(v) {
        return v === null || v === undefined || v === '';
    }

    return { beforeSubmit: beforeSubmit };
});