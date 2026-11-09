/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/runtime', 'N/log', 'N/record'], function (runtime, log, record) {

    function afterSubmit(context) {
        // Absolute guard: never interfere with non-create
        if (!context || context.type !== context.UserEventType.CREATE) {
            return;
        }

        let newRec;
        let employeeId;

        try {
            newRec = context.newRecord;
            employeeId = newRec ? newRec.id : null;

            if (!employeeId) {
                log.audit('Employee Create', 'No employeeId found, exiting safely');
                return;
            }

        } catch (e) {
            // Even if context is corrupted, exit cleanly
            log.error('Context Read Failure', e);
            return;
        }

        // Everything below is NON-CRITICAL logic
        try {
            let execContext = runtime.executionContext || 'UNKNOWN';

            log.audit({
                title: 'Employee Created (Safe)',
                details: {
                    employeeId: employeeId,
                    executionContext: execContext
                }
            });

            // Safe field reads (never assume existence)
            let email = safeGet(newRec, 'email');
            let firstName = safeGet(newRec, 'firstname');
            let lastName = safeGet(newRec, 'lastname');

            log.debug('Employee Snapshot', {
                firstName: firstName,
                lastName: lastName,
                email: email
            });

            // Example: mark employee created via API (optional)
            try {
                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        custentity_employee_created_via_api:
                            execContext === runtime.ContextType.WEBSERVICES ? "True" : ' '
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            } catch (innerErr) {
                // NEVER stop the transaction
                log.error('submitFields failed', innerErr);
            }

        } catch (e) {
            // Final catch-all — must NEVER rethrow
            log.error({
                title: 'Employee AfterSubmit Safe Error',
                details: e
            });
        }
    }

    /**
     * Safe getter — never throws
     */
    function safeGet(rec, fieldId) {
        try {
            return rec.getValue({ fieldId: fieldId });
        } catch (e) {
            log.debug('SafeGet Failed', { fieldId: fieldId, error: e });
            return null;
        }
    }

    return {
        afterSubmit: afterSubmit
    }
});
