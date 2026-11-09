/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function (record, search) {

    function beforeSubmit(context) {
        try {
            let objNewRecord = context.newRecord;

            let intLineCount = objNewRecord.getLineCount('item');
            for (let i = 0; i < intLineCount; i++) {
                let intItemId = objNewRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                let strItemType = search.lookupFields({
                    type: search.Type.ITEM,
                    id: intItemId,
                    columns: 'recordtype'
                }).recordtype;

                let fltItemUnitPrice = objNewRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                });

                record.submitFields({
                    type: strItemType,
                    id: intItemId,
                    values: {
                        'custitem_last_billed_price': fltItemUnitPrice
                    },
                    options: {
                        enablesourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
        } catch (errBeforeSubmit) {
            log.debug('errBeforeSubmit', errBeforeSubmit);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    }
});
