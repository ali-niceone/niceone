/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/email', 'N/url'], function (search, record, email, url) {

    function getInputData() {
        try {
            return search.create({
                type: 'customrecord_no_purch_item_pric_chng',
                filters: ['custrecord_no_pipc_email_sent', search.Operator.IS, false],
                columns: ['custrecord_no_pipc_po_number', 'custrecord_no_pipc_item', 'custrecord_no_pipc_display_name', 'custrecord_no_pipc_old_value', 'custrecord_no_pipc_new_value']
            });
        } catch (errGetInputData) {
            log.debug('errGetInputData', errGetInputData);
        }
    }

    function map(context) {
        try {
            let objJSON = JSON.parse(context.value);
            let recId = objJSON.id;
            let intPoID = objJSON.values['custrecord_no_pipc_po_number'].value;
            let intItemID = objJSON.values['custrecord_no_pipc_item'].value;
            let strItemName = objJSON.values['custrecord_no_pipc_display_name'];
            let fltOldValue = objJSON.values['custrecord_no_pipc_old_value'];
            let fltNewValue = objJSON.values['custrecord_no_pipc_new_value'];

            // Search bills created from this PO for the same item
            let billSearch = search.create({
                type: 'vendorbill',
                filters: [
                    ['createdfrom', 'anyof', intPoID], 'AND',
                    ['item', 'anyof', intItemID]
                ],
                columns: [
                    search.createColumn({ name: 'trandate', sort: search.Sort.DESC }),
                    search.createColumn({ name: 'rate' }),
                    search.createColumn({ name: 'internalid' })
                ]
            });

            let mostRecentBillAmount = null;

            billSearch.run().each(function (result) {
                mostRecentBillAmount = parseFloat(result.getValue({ name: 'rate' })) || 0;
                return false; // stop at first (most recent) bill
            });

            if (mostRecentBillAmount !== null) {
                context.write({
                    key: `${intPoID}_${intItemID}`,
                    value: {
                        amount: mostRecentBillAmount,
                        itemName: strItemName,
                        oldValue: fltOldValue,
                        newValue: fltNewValue
                    }
                });
            }
        } catch (errMap) {
            log.debug('errMap', errMap);
        }
    }

    function reduce(context) {
        try {
            let mapData = JSON.parse(context.values[0]);
            let billValue = mapData.amount;
            let itemName = mapData.itemName;
            let oldValue = mapData.oldValue;
            let newValue = mapData.newValue;
            let [poId, itemId] = context.key.split('_');

            let updatedRecords = [];

            let customRecSearch = search.create({
                type: 'customrecord_no_purch_item_pric_chng',
                filters: [
                    ['custrecord_no_pipc_po_number', 'anyof', poId], 'AND',
                    ['custrecord_no_pipc_item', 'anyof', itemId]
                ],
                columns: ['internalid']
            });

            customRecSearch.run().each(function (result) {
                let recId = result.getValue({ name: 'internalid' });
                record.submitFields({
                    type: 'customrecord_no_purch_item_pric_chng',
                    id: recId,
                    values: {
                        custrecord_no_pipc_bill_value: billValue
                    }
                });
                updatedRecords.push(recId);
                return true;
            });

            let changePercent = null;
            if (isNotEmpty(newValue) && isNotEmpty(billValue)) {
                changePercent = (((parseFloat(billValue) - parseFloat(newValue)) / parseFloat(newValue)) * 100).toFixed(2) + '%';
            } else {
                changePercent = 'N/A';
            }

            context.write(poId, {
                itemId: itemId,
                itemName: itemName,
                oldValue: oldValue,
                newValue: newValue,
                changePercent: changePercent,
                billValue: billValue,
                updated: updatedRecords
            });
        } catch (errReduce) {
            log.debug('errReduce', errReduce);
        }
    }

    function summarize(summary) {
        let resultsByPO = {};

        let host = url.resolveDomain({
            hostType: url.HostType.APPLICATION
        });

        summary.output.iterator().each(function (key, value) {
            let poId = key;
            let data = JSON.parse(value);

            if (!resultsByPO[poId]) {
                resultsByPO[poId] = [];
            }
            resultsByPO[poId].push({
                itemId: data.itemId,
                itemName: data.itemName,
                oldValue: data.oldValue,
                newValue: data.newValue,
                changePercent: data.changePercent,
                billValue: data.billValue
            });
            return true;
        });

        let poIds = Object.keys(resultsByPO);

        poIds.forEach(poId => {
            let objPoData = search.lookupFields({
                type: search.Type.PURCHASE_ORDER,
                id: poId,
                columns: ['tranid', 'entity']
            });

            let strPoNum = objPoData.tranid;

            let strSupplierName = search.lookupFields({
                type: search.Type.VENDOR,
                id: objPoData.entity[0].value,
                columns: 'altname'
            }).altname;

            let mismatchRows = [];

            // Collect only mismatches
            resultsByPO[poId].forEach(data => {
                if (data.newValue && data.billValue) {
                    let newVal = parseFloat(data.newValue);
                    let billVal = parseFloat(data.billValue);

                    if (!isNaN(newVal) && !isNaN(billVal) && newVal !== billVal) {
                        mismatchRows.push(data);
                    }
                }
            });

            // If this PO has no mismatches, skip it
            if (mismatchRows.length === 0) {
                log.debug('Summarize', `PO ${strPoNum} has no mismatches. Skipping email.`);
                return;
            }

            // Build HTML email body for THIS PO only
            let emailBody = `
            <h2>PO ${strPoNum} Bill Mismatches Results</h2>
            <b>Supplier Name:</b> <span>${strSupplierName}</span>
            <h3><a href="https://${host}/app/accounting/transactions/purchord.nl?id=${poId}">PO ${strPoNum}</a> — ✘ ${mismatchRows.length} Mismatches</h3>
            <table border="1" cellpadding="6" cellspacing="0" 
                style="border-collapse:collapse; width:100%; text-align:left; font-family:Arial, sans-serif; font-size:13px;">
                <thead style="background:#f2f2f2;">
                    <tr>
                        <th>Item ID</th>
                        <th>Item Name</th>
                        <th>Buyer Value</th>
                        <th>Approved Value</th>
                        <th>Bill Value</th>
                        <th>Change %</th>
                    </tr>
                </thead>
                <tbody>
        `;

            mismatchRows.forEach(data => {
                emailBody += `
                <tr style="background-color:#ffe6e6;">
                    <td>${data.itemId || ''}</td>
                    <td>${data.itemName || ''}</td>
                    <td>${data.oldValue || ''}</td>
                    <td><b>${data.newValue || ''}</b></td>
                    <td>${data.billValue || ''}</td>
                    <td>${data.changePercent || ''}</td>
                </tr>
            `;
            });

            emailBody += `</tbody></table>`;

            // Send one email per PO
            email.send({
                author: 3096841,
                recipients: [-5],
                cc: [3096841],
                subject: `PO ${strPoNum} Bill Values Mismatches`,
                body: emailBody
            });

            // Mark record as sent
            let customRecSearch = search.create({
                type: 'customrecord_no_purch_item_pric_chng',
                filters: [['custrecord_no_pipc_po_number', 'anyof', poId]],
                columns: ['internalid']
            });

            customRecSearch.run().each(function (result) {
                record.submitFields({
                    type: 'customrecord_no_purch_item_pric_chng',
                    id: result.getValue({ name: 'internalid' }),
                    values: {
                        custrecord_no_pipc_email_sent: true
                    }
                });
                return true;
            });

            log.debug('Summarize', `Email sent for PO ${strPoNum} with ${mismatchRows.length} mismatches.`);
        });
    }

    function isNotEmpty(val) {
        return val !== null && val !== undefined && String(val).trim() !== '' && val !== 0 && val !== '0';
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    }
});
