/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record'], function (search, record) {

    function afterSubmit(context) {
        try {
            if (context.type === 'delete') return;

            let objNewRecord = context.newRecord;
            let intRecordId = objNewRecord.id;
            let strRecordType = objNewRecord.type;

            let objLoadRecord_VB = record.load({
                type: strRecordType,
                id: intRecordId
            })

            let intPoId = objLoadRecord_VB.getSublistValue({
                sublistId: 'purchaseorders',
                fieldId: 'id',
                line: 0
            });
            if (isNotEmpty(intPoId)) {
                let objLoadSearch = search.load({
                    id: 'customsearch_niceone_bills_vs_itemreceip'
                });

                objLoadSearch.filters.push(
                    search.createFilter({
                        name: 'internalid',
                        operator: search.Operator.ANYOF,
                        values: intPoId
                    })
                );

                let arrSearchResult = getAllResults(objLoadSearch);

                arrSearchResult.forEach(result => {
                    let intItemId_IR = result.getValue({
                        name: 'item',
                        join: 'applyingTransaction'
                    });

                    let intItemId_Bill = result.getValue({
                        name: 'item',
                        join: 'billingTransaction'
                    });

                    let fltRateIR = result.getValue({
                        name: 'rate',
                        join: 'applyingTransaction'
                    });

                    let fltRateBill = result.getValue({
                        name: 'rate',
                        join: 'billingTransaction'
                    });

                    if (intItemId_IR == intItemId_Bill && fltRateIR !== fltRateBill) {
                        let intLineNumIR = result.getValue({
                            name: 'linesequencenumber',
                            join: 'applyingTransaction'
                        });

                        let intInternalId_IR = result.getValue({
                            name: 'internalid',
                            join: 'applyingTransaction'
                        });

                        let objLoadRecord_IR = record.load({
                            type: record.Type.ITEM_RECEIPT,
                            id: intInternalId_IR
                        });
                        objLoadRecord_IR.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: Number(intLineNumIR - 1),
                            value: fltRateBill
                        });
                        objLoadRecord_IR.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                        log.debug('Update Item Receipt #' + intInternalId_IR + '', 'New Rate  = ' + fltRateBill);
                    }
                });
            }
        } catch (errAfterSubmit) {
            log.debug('errAfterSubmit', errAfterSubmit);
        }
    }

    function getAllResults(s) {
        var results = s.run()
        var searchResults = []
        var searchId = 0
        do {
            var resultSlice = results.getRange({
                start: searchId,
                end: searchId + 1000
            })
            resultSlice.forEach(function (slice) {
                searchResults.push(slice)
                searchId++
            })
        } while (resultSlice.length >= 1000);
        return searchResults
    }

    function isNotEmpty(val) {
        return val !== null && val !== undefined && String(val).trim() !== '' && val !== 0 && val !== '0';
    }

    return {
        afterSubmit: afterSubmit
    }
});
