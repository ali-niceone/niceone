/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define([], function () {

    function beforeLoad(context) {
        let objNewRecord = context.newRecord;
        let intRecordId = objNewRecord.id;
        let objForm = context.form;

        objForm.removeButton({
            id: 'print'
        });

        objForm.addButton({
            id: 'custpage_print_requisition',
            label: 'Print',
            functionName: 'printRequisition(' + intRecordId + ')'
        });

        objForm.clientScriptModulePath = 'SuiteScripts/no_cs_print_requistion.js';
    }

    return {
        beforeLoad: beforeLoad
    }
});
