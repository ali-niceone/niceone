/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/format', 'N/record', 'N/runtime', 'N/search', 'N/ui/serverWidget', 'N/https', 'N/query', 'N/url', 'N/file', 'N/task'],
    /**
 * @param{format} format
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{serverWidget} serverWidget
 * @param{https} https
 * @param{query} query
 * @param{url} url
 * @param{file} file
 * @param{task} task
 */
    (format, record, runtime, search, serverWidget, https, query, url, file, task) => {

        const MONTHS_LIST = [
            'Jan', 'Feb', 'Mar', 'Apr',
            'May', 'Jun', 'Jul', 'Aug',
            'Sep', 'Oct', 'Nov', 'Dec'
        ];

        const PERIODS_LIST = {
            'period1': 'Jan',
            'period2': 'Feb',
            'period3': 'Mar',
            'period4': 'Apr',
            'period5': 'May',
            'period6': 'Jun',
            'period7': 'Jul',
            'period8': 'Aug',
            'period9': 'Sep',
            'period10': 'Oct',
            'period11': 'Nov',
            'period12': 'Dec'
        };

        const MR_SCRIPT_ID = 'customscript_mr_budget_module_draft';
        const MR_DEPLOYMENT_ID = 'customdeploy_mr_budget_module_draft';

        // Internal id of a File Cabinet folder to hold the throwaway JSON
        // files used to hand line data off to the Map/Reduce script below.
        // TODO: replace with a real folder id from your account (e.g. a
        // dedicated "Budget Draft Temp" folder under SuiteScripts).
        const TEMP_FILE_FOLDER_ID = 7293;

        const DRAFT_PARENT_RECORD = 'customrecord_budget_draft';
        const DRAFT_LINE_RECORD = 'customrecord_budget_draft_lines';

        // custpage_* filter field -> custrecord_* field on the parent record.
        const DRAFT_PARENT_FIELD_MAP = {
            subsidiary: 'custrecord_budget_subsidiary',
            year: 'custrecord_budget_year',
            budgetcategory: 'custrecord_budget_category',
            budgetcategorytype: 'custrecord_budget_category_type',
            currency: 'custrecord_budget_currency',
            department: 'custrecord_budget_department',
            totalBudget: 'custrecord_total_selected_budget'
        };

        const DRAFT_LINE_PARENT_FIELD = 'custrecord_budget_draft_parent';
        const DRAFT_LINE_APPLY_FIELD = 'custrecord_apply_budget';
        const DRAFT_LINE_ACCOUNT_FIELD = 'custrecord_budget_account';
        const DRAFT_LINE_TOTAL_FIELD = 'custrecord_total_budget';

        // Sublist month key (e.g. 'jan') -> custrecord_* field on the child line record.
        const DRAFT_LINE_MONTH_FIELD_MAP = {
            jan: 'custrecord_jan_budget', feb: 'custrecord_feb_budget',
            mar: 'custrecord_mar_budget', apr: 'custrecord_apr_budget',
            may: 'custrecord_may_budget', jun: 'custrecord_jun_budget',
            jul: 'custrecord_jul_budget', aug: 'custrecord_aug_budget',
            sep: 'custrecord_sep_budget', oct: 'custrecord_oct_budget',
            nov: 'custrecord_nov_budget', dec: 'custrecord_dec_budget'
        };

        const currentLoggedUser = runtime.getCurrentUser().id;

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            let objServerRequest = scriptContext.request;
            let objServerResponse = scriptContext.response;
            let objParams = objServerRequest.parameters;

            try {
                // Dynamically grabs your script's accurate ID data directly from the active session
                const currentScriptRecord = runtime.getCurrentScript();

                if (objServerRequest.method === 'POST') {
                    saveBudgetDraft(objServerRequest, objServerResponse);
                    return;
                }

                // Once a Subsidiary is selected but no Year has been chosen yet,
                // resolve the current-year Accounting Period and bounce through a
                // redirect so the Year is reflected in the URL (and therefore
                // survives bookmarking/refresh) instead of waiting for the user
                // to touch the Year field themselves.
                if (isNotNullOrEmpty(objParams.subsidiary) && !isNotNullOrEmpty(objParams.year)) {
                    let yearList = getYear() || [];
                    let defaultYearId = getDefaultYearId(yearList);

                    if (defaultYearId) {
                        redirectWithParams(objServerResponse, currentScriptRecord, {
                            ...objParams,
                            year: defaultYearId
                        });

                        return;
                    }
                }

                if (objServerRequest.method === 'GET') {
                    let objForm = serverWidget.createForm({
                        title: 'Budget (Draft)'
                    });

                    objForm.clientScriptModulePath = '../client/cs_draft_budget_module.js';

                    let subsidiaryId = objParams.subsidiary;
                    let yearId = objParams.year;
                    let departmentId = objParams.department;
                    let draftId = objParams.draftId;
                    let selectedYearLabel = new Date().getFullYear().toString();

                    // Editing an existing draft: pull its header + line data so
                    // the form reopens exactly where the user left off, instead
                    // of starting a fresh blank budget.
                    let draftRecord = null;
                    let draftLinesByAccount = {};
                    let draftSelectedTotal = 0;
                    if (isNotNullOrEmpty(draftId)) {
                        draftRecord = loadDraftRecord(draftId);
                        if (draftRecord) {
                            draftLinesByAccount = getDraftLines(draftId);

                            Object.keys(draftLinesByAccount).forEach(accId => {
                                let draftLine = draftLinesByAccount[accId];
                                if (draftLine.apply === true && isNotNullOrEmpty(draftLine.total)) {
                                    draftSelectedTotal += parseFloat(draftLine.total);
                                }
                            });

                            if (!isNotNullOrEmpty(subsidiaryId)) {
                                subsidiaryId = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.subsidiary);
                            }
                            if (!isNotNullOrEmpty(departmentId)) {
                                departmentId = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.department);
                            }
                            if (!isNotNullOrEmpty(yearId)) {
                                let storedYearValue = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.year);
                                if (isNotNullOrEmpty(storedYearValue)) {
                                    yearId = getContainingYearPeriodId(storedYearValue);
                                }
                            }
                        }
                    }

                    let fldDraftId = objForm.addField({
                        id: 'custpage_draft_id',
                        label: 'Draft ID',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldDraftId.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    if (isNotNullOrEmpty(draftId)) {
                        fldDraftId.defaultValue = draftId;
                    }

                    //#region Filters
                    let fldSubsidiary = objForm.addField({
                        id: 'custpage_subsidiary',
                        label: 'Subsidiary',
                        type: serverWidget.FieldType.SELECT
                    });
                    fldSubsidiary.isMandatory = true;
                    fldSubsidiary.addSelectOption({
                        value: '',
                        text: '',
                        isSelected: true
                    });
                    getSubsidiary().forEach(subsidiary => {
                        fldSubsidiary.addSelectOption({
                            value: subsidiary.id,
                            text: subsidiary.getValue('name')
                        });
                    });
                    if (isNotNullOrEmpty(subsidiaryId)) {
                        fldSubsidiary.defaultValue = subsidiaryId;
                    }
                    if (draftRecord) {
                        let draftSubsidiaryId = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.subsidiary);
                        if (isNotNullOrEmpty(draftSubsidiaryId)) {
                            fldSubsidiary.defaultValue = draftSubsidiaryId;
                        }
                    }

                    let fldYear = objForm.addField({
                        id: 'custpage_year',
                        label: 'Year',
                        type: serverWidget.FieldType.SELECT
                    });
                    fldYear.isMandatory = true;
                    if (isNotNullOrEmpty(subsidiaryId)) {
                        let yearList = getYear() || [];

                        yearList.forEach(year => {
                            fldYear.addSelectOption({
                                value: year.id,
                                text: year.getValue('periodname')
                            });
                        });

                        // Normally the redirect above will have already stamped a
                        // default year onto the URL. This is just a safety net for
                        // cases where the request already carried a year (normal
                        // case) or where no current-year period could be resolved.
                        let effectiveYearId = isNotNullOrEmpty(yearId) ? yearId : getDefaultYearId(yearList);
                        fldYear.defaultValue = effectiveYearId;

                        let matchedYear = yearList.find(
                            year => String(year.id) === String(effectiveYearId)
                        );
                        if (matchedYear) {
                            selectedYearLabel = getYearLabel(matchedYear.getValue('periodname'));
                        }
                    }

                    let fldBudgetCategory = objForm.addField({
                        id: 'custpage_budgetcategory',
                        label: 'Budget Category',
                        type: serverWidget.FieldType.SELECT,
                        source: 'budgetcategory'
                    });
                    fldBudgetCategory.isMandatory = true;
                    if (draftRecord) {
                        fldBudgetCategory.defaultValue = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.budgetcategory);
                    }

                    let fldBudgetCategoryType = objForm.addField({
                        id: 'custpage_budgetcategorytype',
                        label: 'Budget Category Type',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldBudgetCategoryType.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                    if (draftRecord) {
                        fldBudgetCategoryType.defaultValue = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.budgetcategorytype);
                    }

                    let fldCurrency = objForm.addField({
                        id: 'custpage_currency',
                        label: 'Currency',
                        type: serverWidget.FieldType.SELECT,
                        source: 'currency'
                    });
                    fldCurrency.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.DISABLED
                    });
                    fldCurrency.defaultValue = draftRecord
                        ? draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.currency)
                        : 1;

                    let fldDepartment = objForm.addField({
                        id: 'custpage_department',
                        label: 'Department',
                        type: serverWidget.FieldType.SELECT
                    });
                    fldDepartment.addSelectOption({
                        value: '',
                        text: '',
                        isSelected: true
                    });
                    if (isNotNullOrEmpty(subsidiaryId)) {
                        getDepartment(subsidiaryId).forEach(department => {
                            fldDepartment.addSelectOption({
                                value: department.id,
                                text: department.getValue('name')
                            });
                        });
                    }
                    if (draftRecord) {
                        let draftDepartmentId = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.department);
                        if (isNotNullOrEmpty(draftDepartmentId)) {
                            fldDepartment.defaultValue = draftDepartmentId;
                        }
                    } else if (isNotNullOrEmpty(subsidiaryId) && isNotNullOrEmpty(currentLoggedUser)) {
                        let userDepartment = search.lookupFields({
                            type: search.Type.EMPLOYEE,
                            id: currentLoggedUser,
                            columns: 'department'
                        });

                        if (isNotNullOrEmpty(userDepartment) && userDepartment.department.length > 0) {
                            departmentId = userDepartment.department[0].value;
                            fldDepartment.defaultValue = departmentId;
                            fldDepartment.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.INLINE
                            });
                        }
                    }
                    //#endregion Filters

                    //#region Other Fields
                    let fldTotalSelectedBudget = objForm.addField({
                        id: 'custpage_total_selected_budget',
                        label: 'Total Selected Budget',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    fldTotalSelectedBudget.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                    let totalSelectedBudgetValue = 0;
                    if (draftRecord) {
                        let totalBudget = draftRecord.getValue(DRAFT_PARENT_FIELD_MAP.totalBudget);
                        if (isNotNullOrEmpty(totalBudget)) {
                            totalSelectedBudgetValue = parseFloat(totalBudget) || 0;
                        }
                    }
                    fldTotalSelectedBudget.defaultValue = totalSelectedBudgetValue;

                    let fldDepartmentBudgetLimit = objForm.addField({
                        id: 'custpage_department_budget_limit',
                        label: 'Department Budget Limit',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    fldDepartmentBudgetLimit.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                    let departmentBudgetLimitValue = 0;
                    if (isNotNullOrEmpty(subsidiaryId) && isNotNullOrEmpty(departmentId)) {
                        departmentBudgetLimitValue = parseFloat(getDepartmentBudgetLimit(subsidiaryId, departmentId)) || 0;
                    }
                    fldDepartmentBudgetLimit.defaultValue = departmentBudgetLimitValue;

                    let fldRemainingBudgetLimit = objForm.addField({
                        id: 'custpage_remaining_budget_limit',
                        label: 'Remaining Budget Limit',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    fldRemainingBudgetLimit.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                    fldRemainingBudgetLimit.defaultValue = (departmentBudgetLimitValue - totalSelectedBudgetValue).toFixed(2);
                    //#endregion Other Fields

                    objForm.addButton({
                        id: 'custpage_save',
                        label: 'Save',
                        functionName: 'saveBudget()'
                    });

                    //#region Budget sublist
                    let objSublist = objForm.addSublist({
                        id: 'custpage_budget_lines',
                        label: 'Budget Lines',
                        type: serverWidget.SublistType.LIST
                    });

                    objSublist.addButton({
                        id: 'custpage_markall',
                        label: 'Mark All',
                        functionName: 'markAll()'
                    });
                    objSublist.addButton({
                        id: 'custpage_unmarkall',
                        label: 'Unmark All',
                        functionName: 'unMarkAll()'
                    });
                    objSublist.addButton({
                        id: 'custpage_distribute',
                        label: 'Distribute',
                        functionName: 'distribute()'
                    });
                    objSublist.addButton({
                        id: 'custpage_fill',
                        label: 'Fill',
                        functionName: 'fill()'
                    });

                    objSublist.addField({
                        id: 'custpage_apply',
                        label: 'Apply',
                        type: serverWidget.FieldType.CHECKBOX
                    });
                    objSublist.addField({
                        id: 'custpage_account',
                        label: 'Account',
                        type: serverWidget.FieldType.SELECT,
                        source: 'account'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });

                    const currentMonthIndex = new Date().getMonth();
                    MONTHS_LIST.forEach((month, idx) => {
                        let monthField = objSublist.addField({
                            id: `custpage_${month.toString().toLowerCase()}`,
                            label: `${month} ${selectedYearLabel}`,
                            type: serverWidget.FieldType.CURRENCY
                        });

                        // Only enable the column if it matches the current calendar month
                        if (idx === currentMonthIndex) {
                            monthField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.ENTRY
                            });
                        } else {
                            monthField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.DISABLED
                            });
                        }
                    });

                    objSublist.addField({
                        id: 'custpage_total',
                        label: 'Total',
                        type: serverWidget.FieldType.CURRENCY
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.ENTRY
                    });
                    objSublist.addField({
                        id: 'custpage_total_percentage',
                        label: '% of Budget Limit',
                        type: serverWidget.FieldType.PERCENT
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.ENTRY
                    });
                    //#endregion Budget sublist

                    let initialAccounts = getAccounts(subsidiaryId, departmentId) || [];
                    let targetAccountIds = initialAccounts.map(account => account.id);
                    let savedBudgets = getBudget(subsidiaryId, yearId, departmentId, targetAccountIds);

                    let monthSums = {};
                    MONTHS_LIST.forEach(month => {
                        monthSums[month.toString().toLowerCase()] = 0;
                    });
                    let grandTotal = 0;

                    initialAccounts.forEach((account, index) => {
                        objSublist.setSublistValue({
                            id: 'custpage_account',
                            line: index,
                            value: account.id
                        });

                        let draftLine = draftLinesByAccount[account.id];
                        let accountBudgets = draftLine || savedBudgets[account.text];

                        if (accountBudgets) {
                            MONTHS_LIST.forEach(month => {
                                let lowerMonth = month.toString().toLowerCase();
                                if (isNotNullOrEmpty(accountBudgets[lowerMonth])) {
                                    objSublist.setSublistValue({
                                        id: `custpage_${lowerMonth}`,
                                        line: index,
                                        value: accountBudgets[lowerMonth]
                                    });
                                    monthSums[lowerMonth] += parseFloat(accountBudgets[lowerMonth]) || 0;
                                }
                            });

                            if (isNotNullOrEmpty(accountBudgets['total'])) {
                                let lineTotal = parseFloat(accountBudgets['total']) || 0;

                                objSublist.setSublistValue({
                                    id: 'custpage_total',
                                    line: index,
                                    value: accountBudgets['total']
                                });
                                grandTotal += lineTotal;

                                let linePercentage = departmentBudgetLimitValue > 0
                                    ? (lineTotal / departmentBudgetLimitValue) * 100
                                    : 0;
                                objSublist.setSublistValue({
                                    id: 'custpage_total_percentage',
                                    line: index,
                                    value: linePercentage.toFixed(2)
                                });
                            }
                        }

                        if (draftLine && draftLine.apply === true) {
                            objSublist.setSublistValue({
                                id: 'custpage_apply',
                                line: index,
                                value: 'T'
                            });
                        }
                    });

                    // Grand-total footer row, summing every account's months
                    // and Total. Account is deliberately left blank on this
                    // row - the client script uses that (a blank
                    // custpage_account) to recognize and skip this row in
                    // Mark All/Unmark All/Distribute/Fill/checked-total logic.
                    if (initialAccounts.length > 0) {
                        let totalsRowLine = initialAccounts.length;

                        MONTHS_LIST.forEach(month => {
                            let lowerMonth = month.toString().toLowerCase();
                            objSublist.setSublistValue({
                                id: `custpage_${lowerMonth}`,
                                line: totalsRowLine,
                                value: monthSums[lowerMonth].toFixed(2)
                            });
                        });

                        objSublist.setSublistValue({
                            id: 'custpage_total',
                            line: totalsRowLine,
                            value: grandTotal
                        });

                        let grandPercentage = departmentBudgetLimitValue > 0
                            ? (grandTotal / departmentBudgetLimitValue) * 100
                            : 0;
                        objSublist.setSublistValue({
                            id: 'custpage_total_percentage',
                            line: totalsRowLine,
                            value: grandPercentage.toFixed(2)
                        });
                    }

                    objServerResponse.writePage(objForm);
                }
            } catch (errOnRequest) {
                objServerResponse.write(`Error: ${errOnRequest.message}`);
                log.debug('errOnRequest', errOnRequest);
            }
        }

        /**
         * Handles the Save button's POST. Body is JSON:
         * { draftId, header: { subsidiary, year, ... }, lines: [ { account, apply, jan..dec, total }, ... ] }
         *
         * Creates a new Budget (Draft) record, or updates the one named by
         * draftId, then replaces all of its child line records with the
         * submitted lines (only lines that actually carry a value are kept -
         * blank rows for the rest of the chart of accounts are not saved).
         * Responds with { success, recordId, recordUrl } as JSON so the
         * client can redirect to the record's view page.
         */
        const saveBudgetDraft = (objServerRequest, objServerResponse) => {
            try {
                let payload = JSON.parse(objServerRequest.body || '{}');
                let header = payload.header || {};
                let lines = payload.lines || [];

                let draftRecord;
                let isUpdate = isNotNullOrEmpty(payload.draftId);

                if (isUpdate) {
                    draftRecord = record.load({
                        type: DRAFT_PARENT_RECORD,
                        id: payload.draftId
                    });
                } else {
                    draftRecord = record.create({
                        type: DRAFT_PARENT_RECORD
                    });
                }

                Object.keys(DRAFT_PARENT_FIELD_MAP).forEach(headerKey => {
                    let value = header[headerKey];
                    if (isNotNullOrEmpty(value)) {
                        if (headerKey === 'year') {
                            value = getYearRepresentativePeriodId(value) || value;
                        }

                        draftRecord.setValue({
                            fieldId: DRAFT_PARENT_FIELD_MAP[headerKey],
                            value: value
                        });
                    }
                });

                let draftId = draftRecord.save();

                // Lines actually worth persisting - blank rows for the rest
                // of the chart of accounts are dropped here.
                let linesToSave = lines.filter(line => {
                    let hasValue = isNotNullOrEmpty(line.total) ||
                        Object.keys(DRAFT_LINE_MONTH_FIELD_MAP).some(
                            monthKey => isNotNullOrEmpty(line[monthKey])
                        );
                    return hasValue && isNotNullOrEmpty(line.account);
                });

                // Creating dozens/hundreds of child records synchronously
                // here is exactly what triggered SSS_USAGE_LIMIT_EXCEEDED -
                // a Suitelet execution has a fixed ~1000 unit governance
                // budget and record.create()+.save() costs ~10 units each.
                // Handing the lines off to a Map/Reduce task instead gives
                // each record its own fresh governance budget, so this
                // scales to any number of lines.
                queueDraftLinesCreation(draftId, linesToSave, isUpdate);

                let recordUrl = url.resolveRecord({
                    recordType: DRAFT_PARENT_RECORD,
                    recordId: draftId,
                    isEditMode: false
                });

                objServerResponse.write(JSON.stringify({
                    success: true,
                    recordId: draftId,
                    recordUrl: recordUrl,
                    linesQueued: linesToSave.length
                }));
            } catch (errSaveBudgetDraft) {
                log.error('errSaveBudgetDraft', errSaveBudgetDraft);
                objServerResponse.write(JSON.stringify({
                    success: false,
                    message: errSaveBudgetDraft.message
                }));
            }
        };

        /**
         * Writes the lines to a throwaway JSON file and kicks off the
         * Map/Reduce task that actually creates/replaces the child line
         * records. Deletion of any existing lines (on update) happens
         * inside the MR script's getInputData, not here, for the same
         * governance reason.
         */
        const queueDraftLinesCreation = (draftId, linesToSave, isUpdate) => {
            let linesFile = file.create({
                name: `budget_draft_lines_${draftId}_${Date.now()}.json`,
                fileType: file.Type.JSON,
                contents: JSON.stringify(linesToSave),
                folder: TEMP_FILE_FOLDER_ID,
                isOnline: false
            });
            let fileId = linesFile.save();

            let mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: MR_SCRIPT_ID,
                deploymentId: MR_DEPLOYMENT_ID,
                params: {
                    custscript_mrbd_file_id: fileId,
                    custscript_mrbd_draft_id: draftId,
                    custscript_mrbd_is_update: isUpdate
                }
            });
            mrTask.submit();
        };

        const loadDraftRecord = (draftId) => {
            try {
                return record.load({
                    type: DRAFT_PARENT_RECORD,
                    id: draftId
                });
            } catch (errLoadDraftRecord) {
                log.debug('errLoadDraftRecord', errLoadDraftRecord);
                return null;
            }
        };

        /**
         * Returns this draft's line records keyed by account id, in the same
         * shape getBudget() produces (jan..dec, total, plus apply here)
         * so the sublist-population code can treat both sources the same way.
         */
        const getDraftLines = (draftId) => {
            let linesByAccount = {};

            try {
                let lineSearch = search.create({
                    type: DRAFT_LINE_RECORD,
                    filters: [
                        [DRAFT_LINE_PARENT_FIELD, search.Operator.ANYOF, draftId]
                    ],
                    columns: [DRAFT_LINE_ACCOUNT_FIELD, DRAFT_LINE_APPLY_FIELD]
                });

                lineSearch.run().each(result => {
                    let accId = result.getValue(DRAFT_LINE_ACCOUNT_FIELD);

                    let lineRecord = record.load({
                        type: DRAFT_LINE_RECORD,
                        id: result.id
                    });

                    let lineData = {
                        apply: lineRecord.getValue(DRAFT_LINE_APPLY_FIELD) === true
                    };

                    Object.keys(DRAFT_LINE_MONTH_FIELD_MAP).forEach(monthKey => {
                        let amount = lineRecord.getValue(DRAFT_LINE_MONTH_FIELD_MAP[monthKey]);
                        if (isNotNullOrEmpty(amount)) {
                            lineData[monthKey] = formatCurrency(amount);
                        }
                    });

                    let totalAmount = lineRecord.getValue(DRAFT_LINE_TOTAL_FIELD);
                    if (isNotNullOrEmpty(totalAmount)) {
                        lineData['total'] = formatCurrency(totalAmount);
                    }

                    linesByAccount[accId] = lineData;

                    return true;
                });
            } catch (errGetDraftLines) {
                log.error('errGetDraftLines', errGetDraftLines);
            }

            return linesByAccount;
        };

        const redirectWithParams = (response, scriptRecord, parameters) => {
            let cleanParams = {};

            Object.keys(parameters).forEach(key => {
                if (key === 'script' || key === 'deploy' || key === 'compid') {
                    return;
                }

                if (isNotNullOrEmpty(parameters[key])) {
                    cleanParams[key] = parameters[key];
                }
            });

            response.sendRedirect({
                type: https.RedirectType.SUITELET,
                identifier: scriptRecord.id,
                id: scriptRecord.deploymentId,
                parameters: cleanParams
            });
        };

        const getDepartmentBudgetLimit = (subsidiaryId, departmentId) => {
            try {
                if (!isNotNullOrEmpty(subsidiaryId) || !isNotNullOrEmpty(departmentId)) return [];

                let objDeptBudgetLimit = search.create({
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

                if (getAllResults(objDeptBudgetLimit).length > 0) {
                    return getAllResults(objDeptBudgetLimit)[0].getValue('custrecord_bps_budget_limit');
                } else {
                    return 0;
                }
            } catch (errGetDepartmentBudgetLimit) {
                log.debug('errGetDepartmentBudgetLimit', errGetDepartmentBudgetLimit);
            }
        }

        /**
         * Given a list of Accounting Period (year) search results, returns the
         * internal ID of the one matching the current calendar year, or null
         * if none is found (e.g. no open period covers the current year).
         */
        const getYearLabel = (periodName) => {
            let match = /\d{4}/.exec(periodName || '');
            return match ? match[0] : periodName;
        };

        const getDefaultYearId = (yearList) => {
            let currentYear = new Date().getFullYear().toString();

            let matchedYear = (yearList || []).find(
                year => year.getValue('periodname').indexOf(currentYear) !== -1
            );

            return matchedYear ? matchedYear.id : null;
        };

        const getBudget = (subsidiaryId, yearId, departmentId, accountIds) => {
            let budgetMap = {};
            if (!subsidiaryId || !yearId || !accountIds || !accountIds.length) return budgetMap;

            try {
                // periodamount1..periodamount12 are NOT exposed as searchable
                // columns on budgetimport - they only come back via
                // record.load(). So the search here is just used to find
                // which budgetimport records match the filters; each match
                // is then loaded individually to pull its period amounts.
                let filters = [
                    ['subsidiary', search.Operator.ANYOF, subsidiaryId],
                    'AND',
                    ['account', search.Operator.ANYOF, accountIds],
                    'AND',
                    ['year', search.Operator.ANYOF, yearId]
                ];

                if (isNotNullOrEmpty(departmentId)) {
                    filters.push('AND');
                    filters.push(['department', search.Operator.ANYOF, departmentId]);
                }

                let budgetSearch = search.create({
                    type: 'budgetimport',
                    filters: filters,
                    columns: ['account']
                });

                budgetSearch.run().each(result => {
                    let accId = result.getValue('account');

                    let budgetRecord = record.load({
                        type: result.recordType,
                        id: result.id
                    });

                    let monthlyAmounts = {};
                    Object.keys(PERIODS_LIST).forEach(periodKey => {
                        let fieldId = `periodamount${periodKey.replace('period', '')}`;
                        let monthAbbrev = PERIODS_LIST[periodKey].toLowerCase();
                        let amount = budgetRecord.getValue(fieldId);

                        if (isNotNullOrEmpty(amount)) {
                            monthlyAmounts[monthAbbrev] = formatCurrency(amount);
                        }
                    });

                    let totalAmount = budgetRecord.getValue('amount');
                    if (isNotNullOrEmpty(totalAmount)) {
                        monthlyAmounts['total'] = formatCurrency(totalAmount);
                    }

                    budgetMap[accId] = monthlyAmounts;

                    return true;
                });
            } catch (errGetBudget) {
                log.error('errGetBudget', errGetBudget);
            }
            return budgetMap;
        };

        const getSubsidiary = () => {
            try {
                return getAllResults(search.create({
                    type: search.Type.SUBSIDIARY,
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['iselimination', search.Operator.IS, false]
                    ],
                    columns: ['name']
                }));
            } catch (errGetSubsidiary) {
                log.debug('errGetSubsidiary', errGetSubsidiary);
            }
        }

        const getDepartment = (subsidiaryId) => {
            try {
                return getAllResults(search.create({
                    type: search.Type.DEPARTMENT,
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['subsidiary', search.Operator.ANYOF, subsidiaryId]
                    ],
                    columns: ['name']
                }));
            } catch (errGetDepartment) {
                log.debug('errGetDepartment', errGetDepartment);
            }
        }

        /**
         * Returns the list of account internal ids configured on the
         * matching Budget Pre Setup record's multiselect
         * custrecord_bps_account field. The duplicate-prevention UE script
         * on that record guarantees at most one match per
         * subsidiary/department, so the first result is authoritative.
         */
        const getAccounts = (subsidiaryId, departmentId) => {
            try {
                if (!isNotNullOrEmpty(subsidiaryId) || !isNotNullOrEmpty(departmentId)) return [];

                let deptAccountSearch = search.create({
                    type: 'customrecord_budget_pre_setup',
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['custrecord_bps_subsidiary', search.Operator.ANYOF, subsidiaryId],
                        'AND',
                        ['custrecord_bps_department', search.Operator.ANYOF, departmentId]
                    ],
                    columns: ['custrecord_bps_account']
                });

                let results = getAllResults(deptAccountSearch);
                if (!results.length) {
                    return [];
                }

                let accountIdsText = results[0].getValue('custrecord_bps_account');
                if (!isNotNullOrEmpty(accountIdsText)) {
                    return [];
                }

                // Multiselect search columns come back as a comma-separated
                // string of internal ids, not an array.
                let accountIds = accountIdsText.split(',')
                    .map(id => id.trim())
                    .filter(id => id !== '');

                if (accountIds.length === 0) {
                    return [];
                }

                // Fetch account details to get the display names
                // Note: Replace 'customrecord_accounts' and 'name' with your actual record type and field names
                let accountSearch = search.create({
                    type: search.Type.ACCOUNT,
                    filters: [
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['internalid', search.Operator.ANYOF, ...accountIds]
                    ],
                    columns: ['internalid', 'name']
                });

                let accountResults = getAllResults(accountSearch);

                // Create a map for quick lookup
                let accountMap = {};
                accountResults.forEach(result => {
                    accountMap[result.getValue('internalid')] = result.getValue('name') || result.getValue('internalid');
                });

                // Return array of objects with id and text, preserving original order
                return accountIds.map(id => ({
                    id: id,
                    text: accountMap[id] || id // Fallback to ID if name not found
                }));
            } catch (errGetAccounts) {
                log.debug('errGetAccounts', errGetAccounts);
                return [];
            }
        }

        const getYear = () => {
            try {
                let yearSearch = search.create({
                    type: search.Type.ACCOUNTING_PERIOD,
                    filters: [
                        ['isyear', search.Operator.IS, true],
                        'AND',
                        ['isinactive', search.Operator.IS, false],
                        'AND',
                        ['closed', search.Operator.IS, false]
                    ],
                    columns: ['periodname']
                });

                return getAllResults(yearSearch);
            } catch (errGetYear) {
                log.debug('errGetYear', errGetYear);
                return [];
            }
        }

        /**
         * custrecord_budget_year (despite its label) only accepts
         * month-level Accounting Periods, NOT the Year-type "FY 20xx"
         * container record that custpage_year/getBudget() use. Given a
         * Year-type period id, returns the id of its first month period
         * (by start date), for use when writing to that field.
         */
        const getYearRepresentativePeriodId = (yearPeriodId) => {
            try {
                let yearFields = search.lookupFields({
                    type: search.Type.ACCOUNTING_PERIOD,
                    id: yearPeriodId,
                    columns: ['startdate', 'enddate']
                });

                let monthSearch = search.create({
                    type: search.Type.ACCOUNTING_PERIOD,
                    filters: [
                        ['isyear', search.Operator.IS, false],
                        'AND',
                        ['isquarter', search.Operator.IS, false],
                        'AND',
                        ['startdate', search.Operator.ONORAFTER, yearFields.startdate],
                        'AND',
                        ['startdate', search.Operator.ONORBEFORE, yearFields.enddate]
                    ],
                    columns: [
                        search.createColumn({ name: 'startdate', sort: search.Sort.ASC })
                    ]
                });

                let firstResult = monthSearch.run().getRange({ start: 0, end: 1 })[0];
                return firstResult ? firstResult.id : null;
            } catch (errGetYearRepresentativePeriodId) {
                log.debug('errGetYearRepresentativePeriodId', errGetYearRepresentativePeriodId);
                return null;
            }
        };

        /**
         * The inverse of getYearRepresentativePeriodId(): given a month-level
         * period id (as stored on custrecord_budget_year), returns the id of
         * the Year-type period that contains it, for use with
         * custpage_year/getBudget() when reopening a saved draft.
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

        const formatCurrency = (value) => {
            if (isNotNullOrEmpty(value)) {
                return Number(value).toFixed(2);
            }

            return '0.00';
        };

        /**
         * Returns every result from a search.
         *
         * The input must be a search.Search object.
         */
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

        /**
         * Returns false for null, undefined, blank strings,
         * zero, "0", and false.
         */
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

        return { onRequest }

    });