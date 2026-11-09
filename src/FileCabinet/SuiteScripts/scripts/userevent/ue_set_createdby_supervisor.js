/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    (record, search, runtime) => {

        const FIELD_ID = 'custbody_created_by_bills';

        /**
         * 'createdby' is a system field not exposed via record.getValue(),
         * so it has to come from a search.
         */
        const getCreatedByUser = (billId) => {
            const results = search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['type', search.Operator.ANYOF, 'VendBill'],
                    'AND',
                    ['mainline', search.Operator.IS, 'T'],
                    'AND',
                    ['internalid', search.Operator.ANYOF, billId]
                ],
                columns: [search.createColumn({ name: 'createdby' })]
            }).run().getRange({ start: 0, end: 1 });

            if (!results || results.length === 0) return null;
            return results[0].getValue({ name: 'createdby' }) || null;
        };

        /**
         * Supervisor NAME ('' if none) for a given employee id,
         * or null if no employee id.
         */
        const getSupervisorNameByEmployee = (employeeId) => {
            if (!employeeId) return null;

            const employeeLookup = search.lookupFields({
                type: search.Type.EMPLOYEE,
                id: employeeId,
                columns: ['supervisor']
            });

            return employeeLookup.supervisor && employeeLookup.supervisor.length
                ? employeeLookup.supervisor[0].text
                : '';
        };

        /**
         * Creator's CURRENT supervisor name for a saved bill.
         */
        const getCurrentSupervisorName = (billId) =>
            getSupervisorNameByEmployee(getCreatedByUser(billId));

        /**
         * Saved bills: if the stored name equals the current supervisor's name, skip;
         * otherwise save the new name.
         * @returns {string|null} current supervisor name, or null if it can't be determined
         */
        const syncSupervisor = (rec, { save = true } = {}) => {
            const currentName = getCurrentSupervisorName(rec.id);
            if (currentName === null) return null;

            const storedName = String(rec.getValue({ fieldId: FIELD_ID }) || '').trim();

            if (save && storedName !== String(currentName).trim()) {
                // Own try/catch so a failed save never blocks the on-screen value
                try {
                    record.submitFields({
                        type: rec.type,
                        id: rec.id,
                        values: { [FIELD_ID]: currentName },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                } catch (errSave) {
                    log.error({ title: 'syncSupervisor - save failed', details: errSave });
                }
            }
            return currentName;
        };

        const beforeLoad = (scriptContext) => {
            try {
                const { VIEW, EDIT } = scriptContext.UserEventType;
                const type = scriptContext.type;
                const rec = scriptContext.newRecord;

                let name = null;

                if (type === VIEW) {
                    // Refresh the stored value and show it
                    name = syncSupervisor(rec, { save: true });
                } else if (type === EDIT) {
                    // Only show it on the form; afterSubmit saves it
                    name = syncSupervisor(rec, { save: false });
                } else {
                    return;
                }

                if (name !== null) {
                    rec.setText({ fieldId: FIELD_ID, text: name });
                }
            } catch (errBeforeLoad) {
                log.debug({ title: 'errBeforeLoad', details: errBeforeLoad });
            }
        };

        // CREATE / EDIT (on save)
        const afterSubmit = (scriptContext) => {
            try {
                const { CREATE, EDIT } = scriptContext.UserEventType;
                if (![CREATE, EDIT].includes(scriptContext.type)) return;

                syncSupervisor(scriptContext.newRecord);
            } catch (errAfterSubmit) {
                log.debug({ title: 'errAfterSubmit', details: errAfterSubmit });
            }
        };

        return { beforeLoad, afterSubmit };
    });