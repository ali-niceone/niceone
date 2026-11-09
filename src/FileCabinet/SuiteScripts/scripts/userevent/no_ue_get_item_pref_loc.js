/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/https', 'N/url'], function (https, url) {

    function afterSubmit(context) {
        try {
            let objNewRecord = context.newRecord;
            let intRecordId = objNewRecord.id;
            let strRecordType = objNewRecord.type;

            // Replace with your Restlet's URL
            let strRestletURL = url.resolveScript({
                deploymentId: 'customdeploy_no_rl_get_item_pref_loc',
                scriptId: 'customscript_no_rl_get_item_pref_loc',
                returnExternalUrl: true
            });

            let objHeader = {
                'Content-Type': 'application/json',
                // For NLAUTH, use:
                // 'Authorization': 'NLAuth nlauth_account=<ACCOUNT_ID>, nlauth_email=<EMAIL>, nlauth_signature=<PASSWORD>'
                // For token-based auth, use:
                'Authorization': 'NLAuth nlauth_account=<ACCOUNT_ID>, nlauth_consumer_key=<CONSUMER_KEY>, nlauth_token=<TOKEN>, nlauth_signature=<SIGNATURE>'
            };

            let strUrlWithParams = strRestletURL + '&recordId=' + intRecordId + '&recordType=' + strRecordType;

            let objResponse = https.get({
                url: strUrlWithParams,
                headers: objHeader
            });

            log.debug('RESTlet Response', objResponse.body);
        } catch (errAfterSubmit) {
            log.debug('errAfterSubmit', errAfterSubmit);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});
