/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define([], function () {

    function beforeLoad(context) {
        if (context.type !== 'view')
            return;

        let objNewRecord = context.newRecord;
        let intRecordId = objNewRecord.id;
        let strRecordType = objNewRecord.type;
        let objForm = context.form;

        objForm.removeButton({
            id: 'email'
        });

        let approvalStatus = objNewRecord.getText('approvalstatus');
        if (approvalStatus == "Approved") {
            objForm.addButton({
                id: 'custpage_email_po',
                label: 'Email PO',
                functionName: 'emailPO("' + strRecordType + '","' + intRecordId + '")'
            });

            objForm.clientScriptModulePath = '../client/no_cs_email_po.js';
        }
    }

    return {
        beforeLoad: beforeLoad
    }
});
