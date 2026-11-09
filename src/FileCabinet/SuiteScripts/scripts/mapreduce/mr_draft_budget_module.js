/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/record', 'N/runtime', 'N/search'],
    /**
 * @param{file} file
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (file, record, runtime, search) => {

        const DRAFT_LINE_RECORD = 'customrecord_budget_draft_lines';
        const DRAFT_LINE_PARENT_FIELD = 'custrecord_budget_draft_parent';
        const DRAFT_LINE_APPLY_FIELD = 'custrecord_apply_budget';
        const DRAFT_LINE_ACCOUNT_FIELD = 'custrecord_budget_account';
        const DRAFT_LINE_TOTAL_FIELD = 'custrecord_total_budget';

        const DRAFT_LINE_MONTH_FIELD_MAP = {
            jan: 'custrecord_jan_budget', feb: 'custrecord_feb_budget',
            mar: 'custrecord_mar_budget', apr: 'custrecord_apr_budget',
            may: 'custrecord_may_budget', jun: 'custrecord_jun_budget',
            jul: 'custrecord_jul_budget', aug: 'custrecord_aug_budget',
            sep: 'custrecord_sep_budget', oct: 'custrecord_oct_budget',
            nov: 'custrecord_nov_budget', dec: 'custrecord_dec_budget'
        };

        const hasValue = (value) => value !== '' && value !== null && value !== undefined;

        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try {
                let script = runtime.getCurrentScript();
                let fileId = script.getParameter({ name: 'custscript_mrbd_file_id' });
                let draftId = script.getParameter({ name: 'custscript_mrbd_draft_id' });
                let isUpdate = script.getParameter({ name: 'custscript_mrbd_is_update' });

                if (isUpdate === true || isUpdate === 'T' || isUpdate === 'true') {
                    deleteExistingLines(draftId);
                }

                let linesFile = file.load({ id: fileId });
                log.debug('linesFile', linesFile);
                let lines = JSON.parse(linesFile.getContents());
                log.debug('lines', lines);

                // Stamp draftId onto each line so map() is self-contained.
                return lines.map(line => Object.assign({ draftId: draftId }, line));
            } catch (errGetInputData) {
                log.debug('errGetInputData', errGetInputData);
            }
        }

        const deleteExistingLines = (draftId) => {
            let lineSearch = search.create({
                type: DRAFT_LINE_RECORD,
                filters: [
                    [DRAFT_LINE_PARENT_FIELD, search.Operator.ANYOF, draftId]
                ],
                columns: ['internalid']
            });

            let lineIds = [];
            lineSearch.run().each(result => {
                lineIds.push(result.id);
                return true;
            });

            lineIds.forEach(lineId => {
                record.delete({
                    type: DRAFT_LINE_RECORD,
                    id: lineId
                });
            });
        };

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            try {
                let line = JSON.parse(mapContext.value);
                log.debug('line', line);

                let lineRecord = record.create({
                    type: DRAFT_LINE_RECORD
                });

                lineRecord.setValue({
                    fieldId: DRAFT_LINE_PARENT_FIELD,
                    value: line.draftId
                });
                lineRecord.setValue({
                    fieldId: DRAFT_LINE_ACCOUNT_FIELD,
                    value: line.account
                });
                lineRecord.setValue({
                    fieldId: DRAFT_LINE_APPLY_FIELD,
                    value: line.apply === true
                });

                Object.keys(DRAFT_LINE_MONTH_FIELD_MAP).forEach(monthKey => {
                    if (hasValue(line[monthKey])) {
                        lineRecord.setValue({
                            fieldId: DRAFT_LINE_MONTH_FIELD_MAP[monthKey],
                            value: parseFloat(line[monthKey])
                        });
                    }
                });

                if (hasValue(line.total)) {
                    lineRecord.setValue({
                        fieldId: DRAFT_LINE_TOTAL_FIELD,
                        value: parseFloat(line.total)
                    });
                }

                lineRecord.save();
            } catch (errMap) {
                log.debug('errMap', errMap);
            }
        }

        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            let script = runtime.getCurrentScript();
            let fileId = script.getParameter({ name: 'custscript_mrbd_file_id' });

            try {
                if (fileId) {
                    file.delete({ id: fileId });
                }
            } catch (errDeleteFile) {
                log.debug('errDeleteFile', errDeleteFile);
            }

            if (summaryContext.mapSummary.errors) {
                summaryContext.mapSummary.errors.iterator().each((key, error) => {
                    log.error(`Map error on line ${key}`, error);
                    return true;
                });
            }
        }

        return { getInputData, map, summarize }

    });