/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/url'], function (url) {

    function printRequisition(intRecordId) {
        let strSuiteletURL = url.resolveScript({
            deploymentId: 'customdeploy_no_sl_print_requistion',
            scriptId: 'customscript_no_sl_print_requistion',
            params: {
                'recordId': intRecordId
            }
        });

        window.open(strSuiteletURL);
    }

    return {
        pageInit: function () {
            return true;
        },
        printRequisition: printRequisition
    }
});
