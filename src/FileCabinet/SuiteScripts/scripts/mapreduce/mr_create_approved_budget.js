/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/record', 'N/runtime'],
    /**
 * @param{file} file
 * @param{record} record
 * @param{runtime} runtime
 */
    (file, record, runtime) => {

        const MONTH_FIELD_MAP = {
            jan: 'periodamount1', feb: 'periodamount2', mar: 'periodamount3',
            apr: 'periodamount4', may: 'periodamount5', jun: 'periodamount6',
            jul: 'periodamount7', aug: 'periodamount8', sep: 'periodamount9',
            oct: 'periodamount10', nov: 'periodamount11', dec: 'periodamount12'
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
            let script = runtime.getCurrentScript();
            let fileId = script.getParameter({ name: 'custscript_mrsb_file_id' });

            let linesFile = file.load({ id: fileId });
            return JSON.parse(linesFile.getContents());
        }

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
                let script = runtime.getCurrentScript();
                let header = JSON.parse(script.getParameter({ name: 'custscript_mrsb_header_json' }) || '{}');

                let budgetRecord = record.create({
                    type: 'budgetimport'
                });

                // NOTE: 'subsidiary', 'year', 'category', 'currency', 'customer',
                // 'item', 'class', 'department', 'location' are assumed to be
                // the correct body field ids on budgetimport in this account,
                // based on the shape seen via record.load() earlier plus
                // standard NetSuite dimension field naming. Worth a quick check
                // against an actual native budget record if any of these don't
                // save as expected.
                if (hasValue(header.subsidiary)) {
                    budgetRecord.setValue({ fieldId: 'subsidiary', value: header.subsidiary });
                }
                if (hasValue(header.year)) {
                    budgetRecord.setValue({ fieldId: 'year', value: header.year });
                }
                if (hasValue(header.budgetcategory)) {
                    budgetRecord.setValue({ fieldId: 'category', value: header.budgetcategory });
                }
                if (hasValue(header.currency)) {
                    budgetRecord.setValue({ fieldId: 'currency', value: header.currency });
                }
                if (hasValue(header.customer)) {
                    budgetRecord.setValue({ fieldId: 'customer', value: header.customer });
                }
                if (hasValue(header.item)) {
                    budgetRecord.setValue({ fieldId: 'item', value: header.item });
                }
                if (hasValue(header.class)) {
                    budgetRecord.setValue({ fieldId: 'class', value: header.class });
                }
                if (hasValue(header.department)) {
                    budgetRecord.setValue({ fieldId: 'department', value: header.department });
                }
                if (hasValue(header.location)) {
                    budgetRecord.setValue({ fieldId: 'location', value: header.location });
                }

                // Seen as fixed values '1' and 'T' respectively on every
                // existing budgetimport record read earlier in this project -
                // adjust here if that doesn't hold for every scenario.
                budgetRecord.setValue({ fieldId: 'accountingbook', value: '1' });
                budgetRecord.setValue({ fieldId: 'budgettype', value: 'T' });

                budgetRecord.setValue({ fieldId: 'account', value: line.account });

                Object.keys(MONTH_FIELD_MAP).forEach(monthKey => {
                    if (hasValue(line[monthKey])) {
                        budgetRecord.setValue({
                            fieldId: MONTH_FIELD_MAP[monthKey],
                            value: parseFloat(line[monthKey])
                        });
                    }
                });

                if (hasValue(line.total)) {
                    budgetRecord.setValue({ fieldId: 'amount', value: parseFloat(line.total) });
                }

                budgetRecord.save();
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
            let fileId = script.getParameter({ name: 'custscript_mrsb_file_id' });

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