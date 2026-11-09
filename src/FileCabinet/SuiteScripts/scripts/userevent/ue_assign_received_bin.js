/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search'], function (search) {

    function beforeSubmit(context) {
        try {
            // if (context.type !== 'create') return;

            let newRec = context.newRecord;

            let lineCount = newRec.getLineCount('item');
            for (let i = 0; i < lineCount; i++) {
                let itemId = newRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                let locationId = newRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: i
                });

                let inventoryDetail = newRec.getSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });

                let inventoryDetailCount = inventoryDetail.getLineCount('inventoryassignment');
                for (let j = 0; j < inventoryDetailCount; j++) {
                    let lotNumber = inventoryDetail.getSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        line: j
                    });

                    let binSearch = search.create({
                        type: search.Type.INVENTORY_DETAIL,
                        filters: [
                            search.createFilter({
                                name: 'item',
                                operator: search.Operator.ANYOF,
                                values: itemId
                            }),
                            search.createFilter({
                                name: 'location',
                                operator: search.Operator.ANYOF,
                                values: locationId
                            }),
                            search.createFilter({
                                name: 'binnumber',
                                operator: search.Operator.ISNOTEMPTY,
                                values: ''
                            })
                        ],
                        columns: [
                            search.createColumn({
                                name: 'binnumber'
                            })
                        ]
                    }).run().getRange(0, 1)[0].getValue({
                        name: 'binnumber'
                    });

                    inventoryDetail.setSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'binnumber',
                        line: j,
                        value: binSearch
                    });
                }
            }
        } catch (errBeforeSubmit) {
            log.debug('errBeforeSubmit', errBeforeSubmit);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    }
});
