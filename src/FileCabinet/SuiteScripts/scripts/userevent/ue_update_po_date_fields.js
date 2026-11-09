/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Script:      ue_populate_po_from_related.js
 * Description: Deployed on Vendor Bill, Item Receipt, and Event.
 *              On afterSubmit, finds the originating Purchase Order and
 *              populates custom PO header + line fields with data from
 *              the triggering record.
 *
 * Deployments:
 *   1. Record Type: Vendor Bill      (vendorbill)
 *   2. Record Type: Item Receipt     (itemreceipt)
 *   3. Record Type: Event            (task / calendarevent — use "task" in NS)
 *
 * PO Header fields populated:
 *   custbody_bill_date   — Bill trandate
 *   custbody_ir_date     — Item Receipt trandate
 *   custbody_event_date  — Event date (startdate)
 *
 * PO Line fields populated (matched by item internal ID):
 *   custcol_bill_rate    — Bill line rate
 *   custcol_bill_qty     — Bill line quantity
 *   custcol_ir_rate      — Item Receipt line rate
 *   custcol_ir_qty       — Item Receipt line quantity
 */

define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    // ─────────────────────────────────────────────────────────────
    // CONFIGURATION — update field IDs to match your environment
    // ─────────────────────────────────────────────────────────────
    const CONFIG = {
        // PO header custom body fields
        PO_IR_DATE: 'duedate',
        PO_BILL_DATE: 'custbody_bill_date',
        PO_EVENT_DATE: 'custbody_appointment_date',

        // PO line custom column fields
        PO_BILL_RATE: 'custcol_bill_rate',
        PO_BILL_QTY: 'custcol_bill_qty',
        PO_IR_RATE: 'custcol_item_receipt_rate',
        PO_IR_QTY: 'custcol_item_receipt_qty',
        PO_IR_LINE_DATE: 'custcol_item_receipt_line_date'
    };

    // ─────────────────────────────────────────────────────────────
    // ENTRY POINT
    // ─────────────────────────────────────────────────────────────
    const afterSubmit = (context) => {
        if (context.type === context.UserEventType.DELETE) return;

        const triggeringRec = context.newRecord;
        const recType = triggeringRec.type;

        log.debug('afterSubmit triggered', `Type: ${recType} | ID: ${triggeringRec.id}`);

        try {
            if (recType === record.Type.VENDOR_BILL) {
                handleBill(triggeringRec);

            } else if (recType === record.Type.ITEM_RECEIPT) {
                handleItemReceipt(triggeringRec);

            } else if (recType === record.Type.CALENDAR_EVENT) {
                handleEvent(triggeringRec);

            } else {
                log.debug('Unsupported Record Type', recType);
            }
        } catch (e) {
            log.debug('afterSubmit Error', `${e.name}: ${e.message}`);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HANDLER: Vendor Bill
    // ─────────────────────────────────────────────────────────────
    const handleBill = (billRec) => {

        const billRelatedRecs = billRec.getLineCount('purchaseorders');

        for (let i = 0; i < billRelatedRecs; i++) {
            const poId = billRec.getSublistValue({
                sublistId: 'purchaseorders',
                fieldId: 'id',
                line: i
            });

            if (!poId) {
                log.debug('handleBill', 'No createdfrom PO found on Bill ' + billRec.id);
                return;
            }

            const billDate = billRec.getValue('trandate');

            // Collect bill lines: { itemId -> { rate, qty } }
            const billLines = extractLines(billRec, 'item', [
                { field: 'rate', key: 'rate' },
                { field: 'quantity', key: 'qty' },
            ]);

            log.debug('handleBill', `PO ID: ${poId} | Date: ${billDate} | Lines: ${JSON.stringify(billLines)}`);

            updatePO({
                poId,
                headerUpdates: {
                    [CONFIG.PO_BILL_DATE]: billDate,
                },
                lineUpdates: billLines,
                lineFieldMap: {
                    rate: CONFIG.PO_BILL_RATE,
                    qty: CONFIG.PO_BILL_QTY,
                },
            });
        }
    };

    // ─────────────────────────────────────────────────────────────
    // HANDLER: Item Receipt
    // ─────────────────────────────────────────────────────────────
    const handleItemReceipt = (irRec) => {
        // Item Receipts are also linked to PO via "createdfrom"
        const poId = irRec.getValue('createdfrom');
        if (!poId) {
            log.debug('handleItemReceipt', 'No createdfrom PO found on Item Receipt ' + irRec.id);
            return;
        }

        const irDate = irRec.getValue('trandate');

        const irLines = extractItemReceiptLines(irRec, 'item');

        log.debug('handleItemReceipt', `PO ID: ${poId} | Date: ${irDate} | Lines: ${JSON.stringify(irLines)}`);

        updatePO({
            poId,
            headerUpdates: {
                [CONFIG.PO_IR_DATE]: irDate,
            },
            lineUpdates: irLines,
            lineFieldMap: {
                rate: CONFIG.PO_IR_RATE,
                qty: CONFIG.PO_IR_QTY,
                receiptDate: CONFIG.PO_IR_LINE_DATE
            },
        });
    };

    // ─────────────────────────────────────────────────────────────
    // HANDLER: Event (Calendar Event)
    // ─────────────────────────────────────────────────────────────
    const handleEvent = (eventRec) => {
        // Events don't have a native createdfrom link to PO.
        // Strategy: look for the PO internal ID stored on the Event's
        // custom body field "transaction" (set when the Event
        // was created from the PO context, or stamped manually).
        // ── Replace 'transaction' with your actual field ID ──
        const poId = eventRec.getValue('transaction');

        if (!poId) {
            log.debug('handleEvent', 'No related PO field found on Event ' + eventRec.id);
            return;
        }

        // Calendar Events use "startdate" for their date
        const eventDate = eventRec.getValue('startdate');

        log.debug('handleEvent', `PO ID: ${poId} | Date: ${eventDate}`);

        updatePO({
            poId,
            headerUpdates: {
                [CONFIG.PO_EVENT_DATE]: eventDate,
            },
            lineUpdates: {},   // Event has no lines to push
            lineFieldMap: {},
        });
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Extract lines from a record into a map keyed by item ID
    //   sublistId  — e.g. 'item'
    //   fieldDefs  — [{ field: 'rate', key: 'rate' }, ...]
    //   Returns: { [itemId]: { rate: X, qty: Y } }
    // ─────────────────────────────────────────────────────────────
    const extractLines = (rec, sublistId, fieldDefs) => {
        const lineCount = rec.getLineCount({ sublistId });
        const result = {};

        for (let i = 0; i < lineCount; i++) {
            const itemId = rec.getSublistValue({ sublistId, fieldId: 'item', line: i });
            if (!itemId) continue;

            result[itemId] = {};
            for (const { field, key } of fieldDefs) {
                result[itemId][key] = rec.getSublistValue({ sublistId, fieldId: field, line: i });
            }
        }
        return result;
    };

    const extractItemReceiptLines = (rec, sublistId) => {
        const lineCount = rec.getLineCount({
            sublistId
        });

        const result = {};

        for (let i = 0; i < lineCount; i++) {
            const itemReceive = rec.getSublistValue({
                sublistId,
                fieldId: 'itemreceive',
                line: i
            });

            if (itemReceive === false || itemReceive === 'F') {
                continue;
            }

            const itemLine = rec.getSublistValue({
                sublistId,
                fieldId: 'item',
                line: i
            });

            if (!itemLine) {
                continue;
            }

            result[String(itemLine)] = {
                rate: rec.getSublistValue({
                    sublistId,
                    fieldId: 'rate',
                    line: i
                }),
                qty: rec.getSublistValue({
                    sublistId,
                    fieldId: 'quantity',
                    line: i
                }),
                receiptDate: rec.getValue({
                    fieldId: 'trandate'
                })
            };
        }

        return result;
    };

    // ─────────────────────────────────────────────────────────────
    // HELPER: Load the PO and apply header + line updates, then save
    //   poId         — internal ID of the Purchase Order
    //   headerUpdates — { fieldId: value, ... }
    //   lineUpdates   — { [itemId]: { rate, qty } }
    //   lineFieldMap  — { rate: 'custcol_...', qty: 'custcol_...' }
    // ─────────────────────────────────────────────────────────────
    const updatePO = ({ poId, headerUpdates, lineUpdates, lineFieldMap }) => {
        const poRec = record.load({
            type: record.Type.PURCHASE_ORDER,
            id: poId,
            isDynamic: false,   // static mode — more governance-efficient
        });

        // ── Header fields ──
        for (const [fieldId, value] of Object.entries(headerUpdates)) {
            if (value !== null && value !== undefined && value !== '') {
                poRec.setValue({ fieldId, value });
            }
        }

        // ── Line fields — match by item ID ──
        const hasLineUpdates = Object.keys(lineUpdates).length > 0;
        const hasLineFieldMap = Object.keys(lineFieldMap).length > 0;

        if (hasLineUpdates && hasLineFieldMap) {
            const poLineCount = poRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < poLineCount; i++) {
                const poItemId = poRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i,
                });

                const matchedLine = lineUpdates[poItemId];
                if (!matchedLine) continue;  // no matching item in the triggering record

                for (const [dataKey, poFieldId] of Object.entries(lineFieldMap)) {
                    const val = matchedLine[dataKey];
                    if (val !== null && val !== undefined && val !== '') {
                        poRec.setSublistValue({
                            sublistId: 'item',
                            fieldId: poFieldId,
                            line: i,
                            value: val,
                        });
                    }
                }
            }
        }

        const savedId = poRec.save({ ignoreMandatoryFields: true });
        log.audit('updatePO', `PO ${savedId} updated successfully.`);
    };

    // ─────────────────────────────────────────────────────────────
    return { afterSubmit };
});