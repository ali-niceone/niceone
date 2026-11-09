/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/redirect'],
    /**
 * @param{redirect} redirect
 */
    (redirect) => {

        const SCRIPT_ID = 'customscript_sl_budget_module_draft';
        const DEPLOYMENT_ID = 'customdeploy_sl_budget_module_draft';

        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            try {
                if (scriptContext.type !== scriptContext.UserEventType.EDIT) {
                    return;
                }

                let draftRecord = scriptContext.newRecord;

                redirect.toSuitelet({
                    scriptId: SCRIPT_ID,
                    deploymentId: DEPLOYMENT_ID,
                    parameters: {
                        draftId: draftRecord.id,
                        /* subsidiary: draftRecord.getValue('custrecord_budget_subsidiary'),
                        year: draftRecord.getValue('custrecord_budget_year') */
                    }
                });
            } catch (errBeforeLoad) {
                log.debug('errBeforeLoad', errBeforeLoad);
            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => { }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => { }

        return { beforeLoad/* , beforeSubmit, afterSubmit */ }

    });
