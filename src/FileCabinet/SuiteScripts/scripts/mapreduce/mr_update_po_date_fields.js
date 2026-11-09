/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * Script:      mr_populate_po_from_related.js
 * Description: Bulk-updates historical Purchase Orders with data from their
 *              related Vendor Bills, Item Receipts, and Calendar Events.
 *              Only processes POs where at least one custom header field is
 *              empty (null / blank).
 *
 * Stages:
 *   getInputData — Saved search: all POs where any target header field is empty
 *   map          — Key = PO internal ID, Value = needs-flags
 *   reduce       — Fetch all related records, compute updates, save PO once
 *   summarize    — Log success / error counts
 *
 * Line-level logic:
 *   Date  → from the LATEST Bill / IR (trandate DESC)
 *   Rate  → from the LATEST Bill / IR per item (all records iterated
 *            oldest→newest so the newest rate overwrites per item)
 *   Qty   → not stored (removed)
 */

define(['N/record', 'N/search', 'N/log', 'N/format'], (record, search, log, format) => {

    // ─────────────────────────────────────────────────────────────
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────────
    const CONFIG = {
        // ── Target year for the trandate filter (e.g. 2025, 2026) ──
        YEAR: 2026,

        // PO header custom body fields
        PO_IR_DATE: 'duedate',
        PO_BILL_DATE: 'custbody_bill_date',
        PO_EVENT_DATE: 'custbody_appointment_date',

        // PO line custom column fields (rate only — qty removed)
        PO_BILL_RATE: 'custcol_bill_rate',
        PO_IR_RATE: 'custcol_item_receipt_rate',
        PO_IR_LINE_DATE: 'custcol_item_receipt_line_date',

        // Native field on Calendar Event linking to the related transaction (PO)
        EVENT_PO_LINK: 'transaction',
    };

    // ─────────────────────────────────────────────────────────────
    // GET INPUT DATA
    // Returns all POs (Partially/Fully Billed, Received, Pending)
    // where at least one of the three target header fields is empty.
    // ─────────────────────────────────────────────────────────────
    const getInputData = () => {
        log.audit('getInputData', 'Building PO search...');

        const dateFrom = `1/1/${CONFIG.YEAR}`;
        const dateTo = `31/12/${CONFIG.YEAR}`;

        return search.create({
            type: search.Type.TRANSACTION,
            filters: [
                ['type', search.Operator.ANYOF, 'PurchOrd'],
                'AND',
                ['mainline', search.Operator.IS, true],
                'AND',
                ["trandate", "within", dateFrom, dateTo],
                'AND',
                ['status', search.Operator.ANYOF, 'PurchOrd:G', 'PurchOrd:D', 'PurchOrd:F', 'PurchOrd:E'],
                /* 'AND',
                [
                    [CONFIG.PO_IR_DATE, search.Operator.ISEMPTY, ''],
                    'OR',
                    [CONFIG.PO_BILL_DATE, search.Operator.ISEMPTY, ''],
                    'OR',
                    [CONFIG.PO_EVENT_DATE, search.Operator.ISEMPTY, ''],
                ], */
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: 'tranid' }),
                search.createColumn({ name: CONFIG.PO_BILL_DATE }),
                search.createColumn({ name: CONFIG.PO_IR_DATE }),
                search.createColumn({ name: CONFIG.PO_EVENT_DATE }),
            ],
        });
    };

    // ─────────────────────────────────────────────────────────────
    // MAP
    // Emits one entry per PO with flags for which fields still need
    // populating — avoids unnecessary lookups in reduce.
    // ─────────────────────────────────────────────────────────────
    const map = (context) => {
        const result = JSON.parse(context.value);
        const poId = result.id;
        const columns = result.values;

        const needsBillData = !columns[CONFIG.PO_BILL_DATE];
        // const needsIRData = !columns[CONFIG.PO_IR_DATE];
        const needsEventDate = !columns[CONFIG.PO_EVENT_DATE];

        const needsIRData = true;

        log.debug('map', `PO ${poId} — needsBill: ${needsBillData} | needsIR: ${needsIRData} | needsEvent: ${needsEventDate}`);

        context.write({
            key: poId,
            value: JSON.stringify({ poId, needsBillData, needsIRData, needsEventDate }),
        });
    };

    // ─────────────────────────────────────────────────────────────
    // REDUCE
    // One invocation per PO. Fetches all related Bills / IRs / Event,
    // computes the correct date and per-item rates, then saves the PO once.
    // ─────────────────────────────────────────────────────────────
    const reduce = (context) => {
        const poId = context.key;
        const { needsBillData, needsIRData, needsEventDate } = JSON.parse(context.values[0]);

        log.audit('reduce', `Processing PO ${poId}`);

        try {
            const poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: false,
            });

            // ── 1. Vendor Bills ───────────────────────────────────
            if (needsBillData) {
                // getAllBills returns:
                //   latestDate — trandate of the most recent Bill
                //   rateByItem — { [itemId]: rate } from the most recent Bill per item
                const billData = getAllBills(poId);
                if (billData) {
                    poRec.setValue({ fieldId: CONFIG.PO_BILL_DATE, value: billData.latestDate });
                    applyRatesToPO(poRec, billData.rateByItem, CONFIG.PO_BILL_RATE);
                    log.debug('reduce', `PO ${poId}: Bill date=${billData.latestDate} | items=${Object.keys(billData.rateByItem).length}`);
                }
            }

            // ── 2. Item Receipts ──────────────────────────────────
            /* if (needsIRData) {
                const irData = getAllIRs(poId);
                if (irData) {
                    poRec.setValue({ fieldId: CONFIG.PO_IR_DATE, value: irData.latestDate });
                    applyRatesToPO(poRec, irData.rateByItem, CONFIG.PO_IR_RATE);
                    log.debug('reduce', `PO ${poId}: IR date=${irData.latestDate} | items=${Object.keys(irData.rateByItem).length}`);
                }
            } */
            if (needsIRData) {
                const irData = getAllIRs(poId);

                if (irData) {
                    // Latest Item Receipt date for the PO.
                    poRec.setValue({
                        fieldId: CONFIG.PO_IR_DATE,
                        value: irData.latestDate
                    });

                    // Latest rate and latest receipt date for each PO line.
                    applyIRDataToPO(poRec, irData);

                    log.debug(
                        'reduce',
                        `PO ${poId}: IR date=${irData.latestDate} | ` +
                        `lines=${Object.keys(irData.byOrderLine).length}`
                    );
                }
            }

            // ── 3. Calendar Event ─────────────────────────────────
            if (needsEventDate) {
                const eventDate = getLatestEventDate(poId);
                if (eventDate) {
                    poRec.setValue({ fieldId: CONFIG.PO_EVENT_DATE, value: eventDate });
                    log.debug('reduce', `PO ${poId}: Event date=${eventDate}`);
                }
            }

            poRec.save({ ignoreMandatoryFields: true });
            log.audit('reduce', `PO ${poId} saved successfully.`);

        } catch (e) {
            log.error('reduce ERROR', `PO ${poId} — ${e.name}: ${e.message}`);
            throw e;
        }
    };

    // ─────────────────────────────────────────────────────────────
    // SUMMARIZE
    // ─────────────────────────────────────────────────────────────
    const summarize = (summary) => {
        log.audit('summarize', `Usage — Governance: ${summary.usage}`);

        let errorCount = 0;
        summary.reduceSummary.errors.iterator().each((key, error) => {
            log.error('summarize — Reduce Error', `PO ${key}: ${error}`);
            errorCount++;
            return true;
        });

        log.audit('summarize', `Complete. Errors: ${errorCount}`);
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Get all Vendor Bills for a PO
    //
    // Strategy:
    //   Step 1 — search for ALL Bills linked to this PO via
    //            appliedtotransaction join, sorted oldest→newest.
    //   Step 2 — load each Bill and read its item sublist.
    //            Iterating oldest→newest means the newest Bill's rate
    //            naturally overwrites older ones for the same item.
    //   Step 3 — the last row in the search (DESC) gives the latest date.
    //
    // Returns: { latestDate: Date, rateByItem: { [itemId]: rate } } | null
    // ─────────────────────────────────────────────────────────────
    const getAllBills = (poId) => {
        // Fetch all Bill IDs linked to this PO, oldest first so newest rate wins
        const billSearch = search.create({
            type: search.Type.TRANSACTION,
            filters: [
                ['type', search.Operator.ANYOF, "VendBill"],
                'AND',
                ['appliedtotransaction.internalid', search.Operator.ANYOF, poId],
                'AND',
                ['appliedtotransaction.type', search.Operator.ANYOF, 'PurchOrd']
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                // Sort ASC so we iterate oldest→newest; newest rate overwrites per item
                search.createColumn({ name: 'trandate', sort: search.Sort.ASC }),
            ],
        });

        const allBillRows = [];
        billSearch.run().each((row) => {
            allBillRows.push({
                id: row.getValue('internalid'),
                date: row.getValue('trandate'),
            });
            return true;   // continue iterating
        });

        if (!allBillRows.length) return null;

        // Latest date = last row (sorted ASC → last = newest)
        const latestDate = formatDate(allBillRows[allBillRows.length - 1].date);

        // Accumulate rates across all Bills — newest overwrites older for same item
        const rateByItem = {};
        for (const bill of allBillRows) {
            const billRec = record.load({ type: record.Type.VENDOR_BILL, id: bill.id, isDynamic: false });
            const lineCount = billRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const itemId = billRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const rate = billRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                if (!itemId) continue;
                rateByItem[itemId] = rate;   // overwrites — newest Bill wins
            }
        }

        return { latestDate, rateByItem };
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Get all Item Receipts for a PO
    //
    // Same strategy as getAllBills — iterate oldest→newest so the
    // newest IR's rate wins per item. Uses createdfrom for the link.
    //
    // Returns: { latestDate: Date, rateByItem: { [itemId]: rate } } | null
    // ─────────────────────────────────────────────────────────────
    /* const getAllIRs = (poId) => {
        const irSearch = search.create({
            type: search.Type.TRANSACTION,
            filters: [
                ['type', search.Operator.ANYOF, 'ItemRcpt'],
                'AND',
                ['createdfrom', search.Operator.ANYOF, poId],
                'AND',
                ['mainline', search.Operator.IS, true],
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: 'trandate', sort: search.Sort.ASC }),
            ],
        });

        const allIRRows = [];
        irSearch.run().each((row) => {
            allIRRows.push({
                id: row.getValue('internalid'),
                date: row.getValue('trandate'),
            });
            return true;
        });

        if (!allIRRows.length) return null;

        const latestDate = formatDate(allIRRows[allIRRows.length - 1].date);

        const rateByItem = {};
        for (const ir of allIRRows) {
            const irRec = record.load({ type: record.Type.ITEM_RECEIPT, id: ir.id, isDynamic: false });
            const lineCount = irRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const itemId = irRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const rate = irRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                if (!itemId) continue;
                rateByItem[itemId] = rate;   // overwrites — newest IR wins
            }
        }

        return { latestDate, rateByItem };
    }; */
    const getAllIRs = (poId) => {
        const irSearch = search.create({
            type: search.Type.TRANSACTION,
            filters: [
                ['type', search.Operator.ANYOF, 'ItemRcpt'],
                'AND',
                ['createdfrom', search.Operator.ANYOF, poId],
                'AND',
                ['mainline', search.Operator.IS, true]
            ],
            columns: [
                search.createColumn({
                    name: 'internalid',
                    sort: search.Sort.ASC
                }),
                search.createColumn({
                    name: 'trandate',
                    sort: search.Sort.ASC
                })
            ]
        });

        const allIRRows = [];

        irSearch.run().each((row) => {
            allIRRows.push({
                id: row.getValue({
                    name: 'internalid'
                }),
                date: row.getValue({
                    name: 'trandate'
                })
            });

            return true;
        });

        if (!allIRRows.length) {
            return null;
        }

        const latestDate = formatDate(
            allIRRows[allIRRows.length - 1].date
        );

        /*
         * Keyed by the PO line number.
         *
         * Example:
         * {
         *   "1": {
         *      rate: 25.00,
         *      receiptDate: Date
         *   },
         *   "2": {
         *      rate: 10.00,
         *      receiptDate: Date
         *   }
         * }
         */
        const byOrderLine = {};

        // Oldest to newest. Later receipts overwrite earlier values.
        for (const ir of allIRRows) {
            const irRec = record.load({
                type: record.Type.ITEM_RECEIPT,
                id: ir.id,
                isDynamic: false
            });

            const receiptDate = formatDate(ir.date);

            const lineCount = irRec.getLineCount({
                sublistId: 'item'
            });

            for (let i = 0; i < lineCount; i++) {
                const itemReceive = irRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemreceive',
                    line: i
                });

                if (itemReceive === false || itemReceive === 'F') {
                    continue;
                }

                const orderLine = irRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'orderline',
                    line: i
                });

                if (orderLine === null || orderLine === undefined || orderLine === '') {
                    continue;
                }

                const rate = irRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                });

                byOrderLine[String(orderLine)] = {
                    rate,
                    receiptDate
                };
            }
        }

        return {
            latestDate,
            byOrderLine
        };
    };

    const applyIRDataToPO = (poRec, irData) => {
        const lineCount = poRec.getLineCount({
            sublistId: 'item'
        });

        for (let i = 0; i < lineCount; i++) {
            const poOrderLine = poRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'line',
                line: i
            });

            if (
                poOrderLine === null ||
                poOrderLine === undefined ||
                poOrderLine === ''
            ) {
                continue;
            }

            const receiptData = irData.byOrderLine[String(poOrderLine)];

            if (!receiptData) {
                continue;
            }

            if (
                receiptData.rate !== null &&
                receiptData.rate !== undefined &&
                receiptData.rate !== ''
            ) {
                poRec.setSublistValue({
                    sublistId: 'item',
                    fieldId: CONFIG.PO_IR_RATE,
                    line: i,
                    value: receiptData.rate
                });
            }

            if (receiptData && receiptData.receiptDate) {
                poRec.setSublistValue({
                    sublistId: 'item',
                    fieldId: CONFIG.PO_IR_LINE_DATE,
                    line: i,
                    value: receiptData.receiptDate
                });
            }
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Get the latest Calendar Event date linked to a PO
    // Uses the native "transaction" join field on the Event record.
    // Returns: Date | null
    // ─────────────────────────────────────────────────────────────
    const getLatestEventDate = (poId) => {
        const results = search.create({
            type: search.Type.CALENDAR_EVENT,
            filters: [
                ['transaction.internalid', search.Operator.ANYOF, poId],
                'AND',
                ['transaction.type', search.Operator.ANYOF, 'PurchOrd'],
            ],
            columns: [
                search.createColumn({ name: 'startdate', sort: search.Sort.DESC }),
            ],
        }).run().getRange({ start: 0, end: 1 });

        if (!results.length) return null;
        return formatDate(results[0].getValue('startdate'));
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Write rateByItem onto matching PO lines
    //   poRec      — loaded PO (static mode)
    //   rateByItem — { [itemId]: rate }  (from getAllBills / getAllIRs)
    //   rateField  — the custcol_* field ID to write to
    // ─────────────────────────────────────────────────────────────
    const applyRatesToPO = (poRec, rateByItem, rateField) => {
        const lineCount = poRec.getLineCount({ sublistId: 'item' });

        for (let i = 0; i < lineCount; i++) {
            const itemId = poRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            const rate = rateByItem[itemId];

            if (!itemId || rate === null || rate === undefined || rate === '') continue;

            poRec.setSublistValue({ sublistId: 'item', fieldId: rateField, line: i, value: rate });
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Parse a date string returned by search into a JS Date
    // that setValue() on a Date field accepts.
    // ─────────────────────────────────────────────────────────────
    const formatDate = (dateStr) => {
        try {
            return format.parse({ value: dateStr, type: format.Type.DATE });
        } catch (e) {
            log.debug('formatDate error', `value=${dateStr} | ${e.message}`);
            return null;
        }
    };

    // ─────────────────────────────────────────────────────────────
    return { getInputData, map, reduce, summarize };
});