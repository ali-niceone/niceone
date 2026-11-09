/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/file', 'N/record', 'N/search', 'N/task'],
    /**
     * @param{file} file
     * @param{record} record
     * @param{search} search
     * @param{task} task
     */
    (file, record, search, task) => {

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

        // Budget (Draft) parent field -> what the Map/Reduce script needs.
        // Kept separate from the Suitelet's DRAFT_PARENT_FIELD_MAP since
        // this script only needs to READ these, not write them.
        const DRAFT_PARENT_FIELDS = {
            subsidiary: 'custrecord_budget_subsidiary',
            year: 'custrecord_budget_year', // month-level period - see getContainingYearPeriodId
            budgetcategory: 'custrecord_budget_category',
            currency: 'custrecord_budget_currency',
            customer: 'custrecord_budget_customer',
            item: 'custrecord_budget_item',
            class: 'custrecord_business_unit',
            department: 'custrecord_budget_department',
            location: 'custrecord_budget_location'
        };

        const MR_SCRIPT_ID = 'customscript_mr_create_approved_budget';
        const MR_DEPLOYMENT_ID = 'customdeploy_mr_create_approved_budget';

        // Same placeholder as the Suitelet - point this at a real File
        // Cabinet folder id before use.
        const TEMP_FILE_FOLDER_ID = 7293;

        const isNotNullOrEmpty = (value) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string' && value.trim() === '') return false;
            return true;
        };

        /**
         * custrecord_budget_year only accepts month-level Accounting
         * Periods (see the Suitelet for the full explanation) - budgetimport
         * needs the actual Year-type period instead, so it has to be
         * resolved back before use here.
         */
        const getContainingYearPeriodId = (monthPeriodId) => {
            try {
                let monthFields = search.lookupFields({
                    type: search.Type.ACCOUNTING_PERIOD,
                    id: monthPeriodId,
                    columns: ['startdate']
                });

                let yearSearch = search.create({
                    type: search.Type.ACCOUNTING_PERIOD,
                    filters: [
                        ['isyear', search.Operator.IS, true],
                        'AND',
                        ['startdate', search.Operator.ONORBEFORE, monthFields.startdate],
                        'AND',
                        ['enddate', search.Operator.ONORAFTER, monthFields.startdate]
                    ],
                    columns: ['internalid']
                });

                let firstResult = yearSearch.run().getRange({ start: 0, end: 1 })[0];
                return firstResult ? firstResult.id : monthPeriodId;
            } catch (errGetContainingYearPeriodId) {
                log.debug('errGetContainingYearPeriodId', errGetContainingYearPeriodId);
                return monthPeriodId;
            }
        };

        /**
         * Same lookup as the Suitelet's getDepartmentBudgetLimit() - reads
         * the currently stored limit on the matching Budget Pre Setup
         * record.
         */
        const getDepartmentBudgetLimit = (subsidiaryId, departmentId) => {
            try {
                if (!isNotNullOrEmpty(subsidiaryId) || !isNotNullOrEmpty(departmentId)) {
                    return 0;
                }

                let bpsSearch = search.create({
                    type: 'customrecord_budget_pre_setup',
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['custrecord_bps_subsidiary', search.Operator.ANYOF, subsidiaryId],
                        'AND',
                        ['custrecord_bps_department', search.Operator.ANYOF, departmentId]
                    ],
                    columns: ['custrecord_bps_budget_limit']
                });

                let firstResult = bpsSearch.run().getRange({ start: 0, end: 1 })[0];
                return firstResult ? firstResult.getValue('custrecord_bps_budget_limit') : 0;
            } catch (errGetDepartmentBudgetLimit) {
                log.debug('errGetDepartmentBudgetLimit', errGetDepartmentBudgetLimit);
                return 0;
            }
        };

        /**
         * Writes the Remaining Budget Limit onto the matching Budget Pre
         * Setup record. Called ONLY from onAction() below - i.e. only when
         * the draft is actually approved. Save, Open, Pending Approval, and
         * Rejected never touch this (that deduction was previously firing
         * on every Save regardless of status, which was wrong - moved here
         * so it only reflects approved drafts).
         */
        const updateBudgetPreSetupRemainingLimit = (subsidiaryId, departmentId, remainingBudgetLimit) => {
            try {
                if (!isNotNullOrEmpty(subsidiaryId) || !isNotNullOrEmpty(departmentId)) {
                    return;
                }

                let bpsSearch = search.create({
                    type: 'customrecord_budget_pre_setup',
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['custrecord_bps_subsidiary', search.Operator.ANYOF, subsidiaryId],
                        'AND',
                        ['custrecord_bps_department', search.Operator.ANYOF, departmentId]
                    ],
                    columns: ['internalid']
                });

                let firstResult = bpsSearch.run().getRange({ start: 0, end: 1 })[0];
                if (!firstResult) {
                    log.debug(
                        'updateBudgetPreSetupRemainingLimit',
                        `No Budget Pre Setup record found for subsidiary ${subsidiaryId} / department ${departmentId} - limit not updated.`
                    );
                    return;
                }

                record.submitFields({
                    type: 'customrecord_budget_pre_setup',
                    id: firstResult.id,
                    values: {
                        custrecord_bps_budget_limit: remainingBudgetLimit
                    }
                });
            } catch (errUpdateBudgetPreSetupRemainingLimit) {
                log.error('errUpdateBudgetPreSetupRemainingLimit', errUpdateBudgetPreSetupRemainingLimit);
            }
        };

        /**
         * Bind this function to the Approved state/action in the Budget
         * (Draft) workflow (Custom Action / "Trigger a Script"). Runs once,
         * when the record enters that state.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord
         */
        function onAction(scriptContext) {
            let draftRecord = scriptContext.newRecord;
            let draftId = draftRecord.id;

            let header = {};
            Object.keys(DRAFT_PARENT_FIELDS).forEach(key => {
                let value = draftRecord.getValue(DRAFT_PARENT_FIELDS[key]);
                if (isNotNullOrEmpty(value)) {
                    header[key] = value;
                }
            });

            if (isNotNullOrEmpty(header.year)) {
                header.year = getContainingYearPeriodId(header.year);
            }

            // Deduct this draft's Total Selected Budget from the
            // department's available limit - only happens here, on
            // approval, never on a plain Save.
            if (isNotNullOrEmpty(header.subsidiary) && isNotNullOrEmpty(header.department)) {
                let totalSelectedBudget = parseFloat(draftRecord.getValue('custrecord_total_selected_budget')) || 0;
                let departmentBudgetLimit = parseFloat(getDepartmentBudgetLimit(header.subsidiary, header.department)) || 0;
                let remainingBudgetLimit = departmentBudgetLimit - totalSelectedBudget;

                updateBudgetPreSetupRemainingLimit(header.subsidiary, header.department, remainingBudgetLimit);
            }

            let appliedLines = getAppliedLines(draftId);

            if (!appliedLines.length) {
                log.audit(
                    'No lines to budget',
                    `Draft ${draftId} was approved but has no lines with Apply checked - no Budget record created.`
                );
                return;
            }

            let linesFile = file.create({
                name: `std_budget_lines_${draftId}_${Date.now()}.json`,
                fileType: file.Type.JSON,
                contents: JSON.stringify(appliedLines),
                folder: TEMP_FILE_FOLDER_ID,
                isOnline: false
            });
            let fileId = linesFile.save();

            let mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: MR_SCRIPT_ID,
                deploymentId: MR_DEPLOYMENT_ID,
                params: {
                    custscript_mrsb_file_id: fileId,
                    custscript_mrsb_header_json: JSON.stringify(header)
                }
            });
            mrTask.submit();
        }

        /**
         * Only lines where Apply is checked become part of the standard
         * Budget - same "selected lines" concept used throughout the
         * Suitelet UI.
         */
        const getAppliedLines = (draftId) => {
            let lineSearch = search.create({
                type: DRAFT_LINE_RECORD,
                filters: [
                    [DRAFT_LINE_PARENT_FIELD, search.Operator.ANYOF, draftId],
                    'AND',
                    [DRAFT_LINE_APPLY_FIELD, search.Operator.IS, true]
                ],
                columns: [DRAFT_LINE_ACCOUNT_FIELD]
            });

            let lines = [];

            lineSearch.run().each(result => {
                let lineRecord = record.load({
                    type: DRAFT_LINE_RECORD,
                    id: result.id
                });

                let lineData = {
                    account: lineRecord.getValue(DRAFT_LINE_ACCOUNT_FIELD)
                };

                Object.keys(DRAFT_LINE_MONTH_FIELD_MAP).forEach(monthKey => {
                    let amount = lineRecord.getValue(DRAFT_LINE_MONTH_FIELD_MAP[monthKey]);
                    if (isNotNullOrEmpty(amount)) {
                        lineData[monthKey] = amount;
                    }
                });

                let totalAmount = lineRecord.getValue(DRAFT_LINE_TOTAL_FIELD);
                if (isNotNullOrEmpty(totalAmount)) {
                    lineData.total = totalAmount;
                }

                lines.push(lineData);

                return true;
            });

            return lines;
        };

        return { onAction: onAction };

    });