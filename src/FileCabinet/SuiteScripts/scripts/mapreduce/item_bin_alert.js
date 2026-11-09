/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/file', 'N/format'], function (search, email, file, format) {

    function getInputData() {
        try {
            return search.load({
                id: 'customsearch_item_bin_alert'
            });
        } catch (errGetInputData) {
            log.debug('errGetInputData', errGetInputData);
        }
    }

    function map(context) {
        try {
            let objJSON = JSON.parse(context.value);

            let strItemId = objJSON.values['GROUP(itemid)'];
            strItemId = strItemId ? strItemId.split(":")[1]?.trim() || strItemId : "";

            let intAvailQty = parseInt(objJSON.values['SUM(quantityavailable.inventoryNumberBinOnHand)']);
            let intBinMaxQty = parseInt(objJSON.values['MAX(custitem_bin_max)']);
            let intBinMinQty = parseInt(objJSON.values['MIN(custitem_bin_min)']);

            if (intAvailQty <= intBinMinQty) {
                let objItemData = {
                    'itemid': strItemId,
                    'availqty': intAvailQty,
                    'binmax': intBinMaxQty,
                    'binmin': intBinMinQty
                };

                context.write({
                    key: 'inventory_alert',
                    value: objItemData
                });
            }
        } catch (errMap) {
            log.debug('errMap', errMap);
        }
    }

    function reduce(context) {
        try {
            let arrAlertedItems = [];

            context.values.forEach(value => {
                arrAlertedItems.push(JSON.parse(value));
            });

            if (arrAlertedItems.length > 0) {
                let csvContent = "Item ID,Display Name,Available Qty,Bin Min,Bin Max\n";

                arrAlertedItems.forEach(item => {
                    csvContent += `"${item.itemId}","${item.displayName}",${item.availableQty},${item.binMinQty},${item.binMaxQty}\n`;
                });

                let emailSubject = `Item Alert: ${arrAlertedItems.length} Items Below Minimum Bin Level`;

                let emailBody = `
                <html>
                <body>
                    <h2>Item Bin Level Alerts</h2>
                    <p>The attached ${arrAlertedItems.length} items are below their minimum bin levels.</p>
                    <p>Please review and replenish stock as needed.</p>
                </body>
                </html>`;

                let dtCurrentDate = format.format({
                    value: new Date(),
                    type: format.Type.DATETIME
                });

                let csvFile = file.create({
                    name: `Item_Bin_Alerts_${dtCurrentDate}.csv`,
                    fileType: file.Type.CSV,
                    contents: csvContent
                });

                email.send({
                    author: 4990066,
                    recipients: 'z.hassunah@niceonesa.com',
                    subject: emailSubject,
                    body: emailBody,
                    attachments: [csvFile]
                });
            }
        } catch (errReduce) {
            log.debug('errReduce', errReduce);
        }
    }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function (key, value) {
            log.error(key, 'ERROR String: ' + value);

            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    }
});
