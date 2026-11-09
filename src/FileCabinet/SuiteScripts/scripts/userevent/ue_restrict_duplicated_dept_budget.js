/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/url'],
    /**
     * @param{search} search
     * @param{url} url
     */
    (search, url) => {
        /**
         * Prevents more than one Budget Pre Setup record for the same
         * Subsidiary + Department combination.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            // Only relevant when the combination could actually change.
            if (scriptContext.type !== scriptContext.UserEventType.CREATE &&
                scriptContext.type !== scriptContext.UserEventType.EDIT &&
                scriptContext.type !== scriptContext.UserEventType.COPY) {
                return;
            }

            let newRecord = scriptContext.newRecord;
            let subsidiaryId = newRecord.getValue('custrecord_bps_subsidiary');
            let departmentId = newRecord.getValue('custrecord_bps_department');

            let filters = [
                ['isinactive', search.Operator.IS, false],
                'AND',
                ['custrecord_bps_subsidiary', search.Operator.ANYOF, subsidiaryId],
                'AND',
                ['custrecord_bps_department', search.Operator.ANYOF, departmentId]
            ];

            // Exclude the record itself - otherwise every edit of an
            // existing record would flag itself as a duplicate, since its
            // own stored subsidiary/department already match.
            if (isNotNullOrEmpty(newRecord.id)) {
                filters.push('AND');
                filters.push(['internalid', search.Operator.NONEOF, newRecord.id]);
            }

            let objDepartmentBudgetLimitSearch = search.create({
                type: 'customrecord_budget_pre_setup',
                filters: filters,
                columns: ['internalid']
            });

            let existingResults = getAllResults(objDepartmentBudgetLimitSearch);

            if (existingResults.length > 0) {
                let existingRecordId = existingResults[0].id;

                let domain = url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                });
                let relativeUrl = url.resolveRecord({
                    recordType: 'customrecord_budget_pre_setup',
                    recordId: existingRecordId,
                    isEditMode: false
                });
                let existingRecordUrl = `https://${domain}${relativeUrl}`;

                throw new Error(
                    `A Budget Pre Setup record already exists for this Subsidiary/Department combination: ${existingRecordUrl}`
                );
            }
        }

        const getAllResults = (searchObject) => {
            const searchResults = [];

            const pagedData = searchObject.runPaged({
                pageSize: 1000
            });

            pagedData.pageRanges.forEach((pageRange) => {
                const page = pagedData.fetch({
                    index: pageRange.index
                });

                page.data.forEach((result) => {
                    searchResults.push(result);
                });
            });

            return searchResults;
        };

        const isNotNullOrEmpty = (value) => {
            if (value === null || value === undefined) {
                return false;
            }

            if (typeof value === 'string' && value.trim() === '') {
                return false;
            }

            if (value === 0 || value === '0' || value === false) {
                return false;
            }

            return true;
        };

        return { beforeSubmit }

    });