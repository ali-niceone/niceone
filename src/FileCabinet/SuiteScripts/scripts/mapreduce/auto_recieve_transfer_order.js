/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record'], function (search, record) {

    function getInputData() {
        try {
            return search.load({
                id: 'customsearch_3days_ago_transfer_orders',
                type: search.Type.TRANSACTION
            });
        } catch (errGetInputData) {
            log.debug('errGetInputData', errGetInputData);
        }
    }

    function map(context) {
        try {
            let jsonObj = JSON.parse(context.value);

            let objTransformedRecord = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: jsonObj.id,
                toType: record.Type.ITEM_RECEIPT
            });

            objTransformedRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });
        } catch (errMap) {
            log.debug('errMap', errMap);
        }
    }

    function reduce(context) { }

    function summarize(summary) {
        summary.mapSummary.errors.iterator().each(function (key, value) {
            log.error(key, 'ERROR String: ' + value);

            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        // reduce: reduce,
        summarize: summarize
    }
});
