/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/ui/message', 'N/url'],
    /**
     * @param{currentRecord} currentRecord
     * @param{record} record
     * @param{message} message
     * @param{url} url
     */
    function (currentRecord, record, message, url) {

        const SCRIPT_ID = 'customscript_sl_budget_module_draft';
        const DEPLOYMENT_ID = 'customdeploy_sl_budget_module_draft';
        const SUBLIST_ID = 'custpage_budget_lines';
        const MONTH_FIELD_IDS = [
            'custpage_jan', 'custpage_feb', 'custpage_mar', 'custpage_apr',
            'custpage_may', 'custpage_jun', 'custpage_jul', 'custpage_aug',
            'custpage_sep', 'custpage_oct', 'custpage_nov', 'custpage_dec'
        ];

        /**
         * Shows a dismissible error banner instead of a blocking alert().
         *
         * @param {string} title
         * @param {string} details
         */
        function showError(title, details) {
            message.create({
                title: title,
                message: details,
                type: message.Type.ERROR
            }).show({ duration: 8000 });
        }

        /**
         * The grand-total footer row (added server-side only when there's
         * at least one account) is identified by having a blank Account -
         * a self-describing check rather than assuming it's always the
         * last line, so this stays correct even if that ever changes.
         */
        function isTotalsRowLine(objCurrentRecord, line) {
            let accountValue = objCurrentRecord.getSublistValue({
                sublistId: SUBLIST_ID,
                fieldId: 'custpage_account',
                line: line
            });
            return !accountValue;
        }

        let pendingRecalculateTimeout = null;

        /**
         * Debounced wrapper around recalculateTotalsAndPercentages(), used
         * only from fieldChanged. If commitLine() fires fieldChanged again
         * before this runs (e.g. once per line during a bulk edit), the
         * previous schedule is cancelled and pushed back - collapsing a
         * burst of triggers into a single recompute after everything
         * settles, instead of one redundant recompute per trigger.
         */
        function scheduleRecalculateTotalsAndPercentages(objCurrentRecord) {
            if (pendingRecalculateTimeout) {
                clearTimeout(pendingRecalculateTimeout);
            }
            pendingRecalculateTimeout = setTimeout(() => {
                pendingRecalculateTimeout = null;
                recalculateTotalsAndPercentages(objCurrentRecord);
            }, 0);
        }

        let isRecalculatingTotals = false;

        /**
         * Recomputes every real line's Total (derived fresh from its own 12
         * months, since Total is disabled/read-only for the user and must
         * be kept in sync with whatever the months currently add up to -
         * this is what makes manual month edits, Fill, and Distribute all
         * flow through correctly), each line's "% of Budget Limit" column,
         * the grand-total footer row, and the page-level Total Selected
         * Budget / Remaining Budget Limit fields.
         *
         * Writes use selectLine/setCurrentSublistValue/commitLine, not
         * setSublistValue() - the latter is not a supported write method on
         * this Suitelet's client-side record object (only reads work via
         * getSublistValue()); every other working write in this file
         * already uses the selectLine pattern.
         *
         * Always a full recompute rather than tracking which single line
         * changed - fieldChanged's lineNum isn't reliably available for
         * this List-type sublist (same reasoning as the Apply-checkbox
         * handler), and Fill/Distribute/manual edits can each touch one or
         * many lines. Guarded against re-entrancy in case committing a line
         * here ever triggers fieldChanged again for a field this function
         * itself just set.
         */
        function recalculateTotalsAndPercentages(objCurrentRecord) {
            if (isRecalculatingTotals) {
                return;
            }
            isRecalculatingTotals = true;

            try {
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });
                if (lineCount === 0) {
                    return;
                }

                let deptBudgetLimit = parseFloat(objCurrentRecord.getValue('custpage_department_budget_limit')) || 0;

                let totalsRowLine = -1;
                let grandTotal = 0;
                let monthSums = {};
                MONTH_FIELD_IDS.forEach(monthFieldId => {
                    monthSums[monthFieldId] = 0;
                });

                for (let line = 0; line < lineCount; line++) {
                    if (isTotalsRowLine(objCurrentRecord, line)) {
                        totalsRowLine = line;
                        continue;
                    }

                    let lineTotal = 0;
                    MONTH_FIELD_IDS.forEach(monthFieldId => {
                        let monthValue = parseFloat(objCurrentRecord.getSublistValue({
                            sublistId: SUBLIST_ID, fieldId: monthFieldId, line: line
                        })) || 0;
                        lineTotal += monthValue;
                        monthSums[monthFieldId] += monthValue;
                    });

                    let percentage = deptBudgetLimit > 0 ? (lineTotal / deptBudgetLimit) * 100 : 0;

                    objCurrentRecord.selectLine({ sublistId: SUBLIST_ID, line: line });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total',
                        value: lineTotal
                    });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total_percentage',
                        value: percentage.toFixed(2)
                    });
                    objCurrentRecord.commitLine({ sublistId: SUBLIST_ID });

                    grandTotal += lineTotal;
                }

                if (totalsRowLine !== -1) {
                    let grandPercentage = deptBudgetLimit > 0 ? (grandTotal / deptBudgetLimit) * 100 : 0;

                    objCurrentRecord.selectLine({ sublistId: SUBLIST_ID, line: totalsRowLine });
                    MONTH_FIELD_IDS.forEach(monthFieldId => {
                        objCurrentRecord.setCurrentSublistValue({
                            sublistId: SUBLIST_ID,
                            fieldId: monthFieldId,
                            value: monthSums[monthFieldId]
                        });
                    });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total',
                        value: grandTotal
                    });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total_percentage',
                        value: grandPercentage.toFixed(2)
                    });
                    objCurrentRecord.commitLine({ sublistId: SUBLIST_ID });
                }

                updateSelectedTotalField(objCurrentRecord);
            } finally {
                isRecalculatingTotals = false;
            }
        }

        /**
         * Sums 'custpage_total' across every currently-checked line in the
         * Budget Lines sublist. Recomputed from scratch on every checkbox
         * change (fieldChanged only tells you about the ONE line that just
         * changed, so there's no running total to accumulate onto - the
         * whole sublist has to be walked each time).
         *
         * Uses getSublistValue(), not getCurrentSublistValue(): the latter
         * only reads the line currently being edited, not an arbitrary line
         * picked out by index while looping.
         *
         * @param {Record} objCurrentRecord
         * @returns {number} totalBudget
         */
        function getSelectedLinesTotal(objCurrentRecord) {
            let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });
            let totalBudget = 0;

            for (let line = 0; line < lineCount; line++) {
                if (isTotalsRowLine(objCurrentRecord, line)) {
                    continue;
                }

                let isApplied = objCurrentRecord.getSublistValue({
                    sublistId: SUBLIST_ID,
                    fieldId: 'custpage_apply',
                    line: line
                });

                if (isApplied === true) {
                    let lineTotal = objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total',
                        line: line
                    });

                    totalBudget += parseFloat(lineTotal) || 0;
                }
            }

            return totalBudget.toFixed(2);
        }

        /**
         * Recomputes the checked-lines total and writes it onto the
         * page-level 'custpage_total_selected_budget' display field.
         *
         * @param {Record} objCurrentRecord
         * @returns {number} totalBudget
         */
        function updateSelectedTotalField(objCurrentRecord) {
            let deptBudgetLimit = objCurrentRecord.getValue({ fieldId: 'custpage_department_budget_limit' });
            let totalBudget = getSelectedLinesTotal(objCurrentRecord);

            objCurrentRecord.setValue({
                fieldId: 'custpage_total_selected_budget',
                value: totalBudget
            });

            objCurrentRecord.setValue({
                fieldId: 'custpage_remaining_budget_limit',
                value: parseFloat(deptBudgetLimit - totalBudget).toFixed(2)
            });

            return totalBudget;
        }

        /**
         * "Mark All" button: checks every line's Apply box, then rolls the
         * checked-lines total (only lines whose Total actually has a value
         * contribute, since blanks parse to 0) into Total Selected Budget.
         */
        function markAll() {
            try {
                let objCurrentRecord = currentRecord.get();
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });

                for (let line = 0; line < lineCount; line++) {
                    if (isTotalsRowLine(objCurrentRecord, line)) {
                        continue;
                    }

                    objCurrentRecord.selectLine({
                        sublistId: SUBLIST_ID,
                        line: line
                    });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_apply',
                        value: true
                    });
                    objCurrentRecord.commitLine({
                        sublistId: SUBLIST_ID
                    });
                }

                updateSelectedTotalField(objCurrentRecord);
            } catch (errMarkAll) {
                showError('Unable to mark all lines', errMarkAll.message);
            }
        }

        /**
         * "Unmark All" button: unchecks every line and zeroes out Total
         * Selected Budget.
         */
        function unMarkAll() {
            try {
                let objCurrentRecord = currentRecord.get();
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });

                for (let line = 0; line < lineCount; line++) {
                    if (isTotalsRowLine(objCurrentRecord, line)) {
                        continue;
                    }

                    objCurrentRecord.selectLine({
                        sublistId: SUBLIST_ID,
                        line: line
                    });
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_apply',
                        value: false
                    });
                    objCurrentRecord.commitLine({
                        sublistId: SUBLIST_ID
                    });
                }

                objCurrentRecord.setValue({
                    fieldId: 'custpage_total_selected_budget',
                    value: 0
                });
                objCurrentRecord.setValue({
                    fieldId: 'custpage_remaining_budget_limit',
                    value: objCurrentRecord.getValue('custpage_department_budget_limit')
                });
            } catch (errUnmarkAll) {
                showError('Unable to unmark all lines', errUnmarkAll.message);
            }
        }

        /**
         * "Distribute" button: takes the value from the current open month
         * and distributes it evenly across all 12 months.
         */
        function distribute() {
            try {
                let objCurrentRecord = currentRecord.get();
                let currentMonthIndex = new Date().getMonth();
                let currentMonthFieldId = MONTH_FIELD_IDS[currentMonthIndex];
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });

                for (let line = 0; line < lineCount; line++) {
                    if (isTotalsRowLine(objCurrentRecord, line)) {
                        continue;
                    }

                    let isApplied = objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_apply',
                        line: line
                    });
                    if (isApplied !== true) {
                        continue;
                    }

                    let monthValue = parseFloat(objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: currentMonthFieldId,
                        line: line
                    })) || 0;

                    if (!monthValue) {
                        continue;
                    }

                    let monthlyAmount = monthValue / 12;

                    objCurrentRecord.selectLine({
                        sublistId: SUBLIST_ID,
                        line: line
                    });
                    MONTH_FIELD_IDS.forEach(monthFieldId => {
                        objCurrentRecord.setCurrentSublistValue({
                            sublistId: SUBLIST_ID,
                            fieldId: monthFieldId,
                            value: monthlyAmount
                        });
                    });
                    objCurrentRecord.commitLine({
                        sublistId: SUBLIST_ID
                    });
                }

                recalculateTotalsAndPercentages(objCurrentRecord);
            } catch (errDistribute) {
                showError('Unable to distribute totals', errDistribute.message);
            }
        }

        /**
         * "Fill" button: takes the value from the current open month
         * and populates all 12 months with it.
         */
        function fill() {
            try {
                let objCurrentRecord = currentRecord.get();
                let currentMonthIndex = new Date().getMonth();
                let currentMonthFieldId = MONTH_FIELD_IDS[currentMonthIndex];
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });

                for (let line = 0; line < lineCount; line++) {
                    if (isTotalsRowLine(objCurrentRecord, line)) {
                        continue;
                    }

                    let isApplied = objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_apply',
                        line: line
                    });
                    if (isApplied !== true) {
                        continue;
                    }

                    let sourceValue = parseFloat(objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: currentMonthFieldId,
                        line: line
                    })) || 0;

                    if (!sourceValue) {
                        continue;
                    }

                    let lineTotal = 0;
                    objCurrentRecord.selectLine({
                        sublistId: SUBLIST_ID,
                        line: line
                    });
                    MONTH_FIELD_IDS.forEach(monthFieldId => {
                        objCurrentRecord.setCurrentSublistValue({
                            sublistId: SUBLIST_ID,
                            fieldId: monthFieldId,
                            value: sourceValue
                        });
                        lineTotal += sourceValue;
                    });

                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total',
                        value: lineTotal
                    });

                    objCurrentRecord.commitLine({
                        sublistId: SUBLIST_ID
                    });
                }

                recalculateTotalsAndPercentages(objCurrentRecord);
            } catch (errFill) {
                showError('Unable to fill months', errFill.message);
            }
        }

        /**
         * '-1' is the placeholder value used for the blank option on
         * Item/Business Unit/Department/Location - treat it as "no value"
         * rather than sending the literal string to the server.
         */
        function cleanSelectValue(value) {
            return (value && value !== '-1') ? value : null;
        }

        /**
         * Builds the header portion of the Save payload. Keys match
         * DRAFT_PARENT_FIELD_MAP on the Suitelet side.
         */
        function buildHeaderPayload(objCurrentRecord) {
            return {
                subsidiary: objCurrentRecord.getValue('custpage_subsidiary'),
                year: objCurrentRecord.getValue('custpage_year'),
                budgetcategory: objCurrentRecord.getValue('custpage_budgetcategory'),
                budgetcategorytype: getBudgetCategoryType(objCurrentRecord.getValue('custpage_budgetcategory')),
                currency: objCurrentRecord.getValue('custpage_currency'),
                department: cleanSelectValue(objCurrentRecord.getValue('custpage_department')),
                totalBudget: objCurrentRecord.getValue('custpage_total_selected_budget')
            };
        }

        /**
         * Builds the lines portion of the Save payload - every real
         * account line, regardless of Apply state (the grand-total footer
         * row is skipped - it's never a real budget line). The Suitelet
         * decides which of these lines are actually worth persisting
         * (anything with a value anywhere).
         */
        function buildLinesPayload(objCurrentRecord) {
            let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });
            let lines = [];

            for (let line = 0; line < lineCount; line++) {
                if (isTotalsRowLine(objCurrentRecord, line)) {
                    continue;
                }

                let lineData = {
                    account: objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID, fieldId: 'custpage_account', line: line
                    }),
                    apply: objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID, fieldId: 'custpage_apply', line: line
                    }) === true,
                    total: objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID, fieldId: 'custpage_total', line: line
                    })
                };

                MONTH_FIELD_IDS.forEach(monthFieldId => {
                    let monthKey = monthFieldId.replace('custpage_', '');
                    lineData[monthKey] = objCurrentRecord.getSublistValue({
                        sublistId: SUBLIST_ID, fieldId: monthFieldId, line: line
                    });
                });

                lines.push(lineData);
            }

            return lines;
        }

        /**
         * Full-screen blocking overlay shown while Save is in flight, so the
         * user can't edit fields, click buttons, or navigate away mid-save.
         * Built inline (no separate CSS/asset pipeline available on a
         * native Suitelet page).
         */
        function showLoadingOverlay() {
            if (document.getElementById('custpage-loading-overlay')) {
                return;
            }

            let style = document.createElement('style');
            style.id = 'custpage-loading-style';
            style.textContent = `
                #custpage-loading-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255, 255, 255, 0.6);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: wait;
                }
                #custpage-loading-overlay .custpage-spinner {
                    width: 48px;
                    height: 48px;
                    border: 5px solid #cfd8dc;
                    border-top-color: #1976d2;
                    border-radius: 50%;
                    animation: custpage-spin 0.8s linear infinite;
                }
                @keyframes custpage-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);

            let overlay = document.createElement('div');
            overlay.id = 'custpage-loading-overlay';
            overlay.innerHTML = '<div class="custpage-spinner"></div>';
            document.body.appendChild(overlay);
        }

        function hideLoadingOverlay() {
            let overlay = document.getElementById('custpage-loading-overlay');
            if (overlay) {
                overlay.parentNode.removeChild(overlay);
            }
        }

        /**
         * "Save" button: POSTs the current header + sublist state to this
         * same Suitelet as JSON (a native form submit isn't used here, same
         * reasoning as the PO approval workflow - the List-type sublist with
         * custom buttons doesn't play well with NetSuite's native submit
         * cycle). On success, redirects to the new/updated record's view page.
         */
        function saveBudget() {
            try {
                let objCurrentRecord = currentRecord.get();

                let subsidiaryId = objCurrentRecord.getValue('custpage_subsidiary');
                let yearId = objCurrentRecord.getValue('custpage_year');
                let budgetCategory = objCurrentRecord.getValue('custpage_budgetcategory');
                let totalSelectedBudget = objCurrentRecord.getValue('custpage_total_selected_budget');
                let deptBudgetLimit = objCurrentRecord.getValue('custpage_department_budget_limit');

                if (!subsidiaryId || !yearId || !budgetCategory) {
                    showError(
                        'Missing required fields',
                        'Subsidiary, Year, and Budget Category are required before saving.'
                    );
                    return;
                }

                let lines = buildLinesPayload(objCurrentRecord);
                let hasAppliedLine = lines.some(line => line.apply === true);
                if (!hasAppliedLine) {
                    showError(
                        'No lines selected',
                        'Check the Apply box on at least one line before saving.'
                    );
                    return;
                }

                if (totalSelectedBudget > deptBudgetLimit) {
                    showError(
                        'Budget Limitation',
                        'Total Selected Budget is higher than Department Budget Limit.'
                    );
                    return;
                }

                let draftId = objCurrentRecord.getValue('custpage_draft_id');

                let payload = {
                    draftId: draftId || null,
                    header: buildHeaderPayload(objCurrentRecord),
                    lines: buildLinesPayload(objCurrentRecord)
                };

                let suiteletURL = url.resolveScript({
                    deploymentId: DEPLOYMENT_ID,
                    scriptId: SCRIPT_ID
                });

                showLoadingOverlay();

                fetch(suiteletURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            window.onbeforeunload = null;
                            window.location.href = result.recordUrl;
                        } else {
                            hideLoadingOverlay();
                            showError('Unable to save budget', result.message || 'Unknown error');
                        }
                    })
                    .catch(errFetch => {
                        hideLoadingOverlay();
                        showError('Unable to save budget', errFetch.message);
                    });
            } catch (errSaveBudget) {
                hideLoadingOverlay();
                showError('Unable to save budget', errSaveBudget.message);
            }
        }

        function pageInit(scriptContext) {
            try {
                let objCurrentRecord = scriptContext.currentRecord;
                let currentMonthIndex = new Date().getMonth();
                let lineCount = objCurrentRecord.getLineCount({ sublistId: SUBLIST_ID });

                for (let i = 0; i < lineCount; i++) {
                    let totalFld = objCurrentRecord.getSublistField({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total',
                        line: i
                    });
                    if (totalFld) {
                        totalFld.isDisabled = true;
                    }

                    let budgetPercentFld = objCurrentRecord.getSublistField({
                        sublistId: SUBLIST_ID,
                        fieldId: 'custpage_total_percentage',
                        line: i
                    });
                    if (budgetPercentFld) {
                        budgetPercentFld.isDisabled = true;
                    }

                    let isTotalsRow = isTotalsRowLine(objCurrentRecord, i);

                    MONTH_FIELD_IDS.forEach((monthFieldId, mIndex) => {
                        let monthFld = objCurrentRecord.getSublistField({
                            sublistId: SUBLIST_ID,
                            fieldId: monthFieldId,
                            line: i
                        });
                        if (monthFld) {
                            if (!isTotalsRow && mIndex === currentMonthIndex) {
                                monthFld.isDisabled = false;
                            } else {
                                monthFld.isDisabled = true;
                            }
                        }
                    });

                    if (isTotalsRow) {
                        let applyFld = objCurrentRecord.getSublistField({
                            sublistId: SUBLIST_ID,
                            fieldId: 'custpage_apply',
                            line: i
                        });
                        if (applyFld) {
                            applyFld.isDisabled = true;
                        }
                    }
                }
            } catch (errPageInit) {
                showError('Unable to initiate the page', errPageInit.message);
            }
        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            try {
                let fieldId = scriptContext.fieldId;
                let sublistId = scriptContext.sublistId;
                let objCurrentRecord = scriptContext.currentRecord;

                if (sublistId === 'custpage_budget_lines' && fieldId === 'custpage_apply') {
                    updateSelectedTotalField(objCurrentRecord);
                    return;
                }

                if (sublistId === 'custpage_budget_lines' && fieldId === 'custpage_total') {
                    // Deferred (and debounced), not called directly:
                    // commitLine() appears to fire fieldChanged
                    // synchronously in this environment, so a direct call
                    // here can run while Fill/Distribute's own
                    // selectLine/commitLine loop is still mid-line,
                    // corrupting which line is "current" for both. Pushing
                    // this to the next tick lets any in-progress bulk edit
                    // finish first; recalculateTotalsAndPercentages() is a
                    // full, idempotent recompute, so a slightly delayed or
                    // occasionally redundant run is harmless.
                    scheduleRecalculateTotalsAndPercentages(objCurrentRecord);
                    return;
                }

                if (sublistId === 'custpage_budget_lines' && MONTH_FIELD_IDS.indexOf(fieldId) !== -1) {
                    scheduleRecalculateTotalsAndPercentages(objCurrentRecord);
                    return;
                }

                const TRIGGER_FIELDS = [
                    'custpage_subsidiary',
                    'custpage_year',
                    'custpage_department'
                ];

                if (TRIGGER_FIELDS.indexOf(fieldId) === -1) {
                    return;
                }

                let subsidiaryId = objCurrentRecord.getValue('custpage_subsidiary');
                let yearId = objCurrentRecord.getValue('custpage_year');
                let departmentId = objCurrentRecord.getValue('custpage_department');

                if (fieldId === 'custpage_subsidiary') {
                    yearId = null;
                    departmentId = null;
                }

                let params = {};
                if (isNotNullOrEmpty(subsidiaryId)) {
                    params.subsidiary = subsidiaryId;
                }
                if (isNotNullOrEmpty(yearId)) {
                    params.year = yearId;
                }
                if (isNotNullOrEmpty(departmentId)) {
                    params.department = departmentId;
                }

                let suiteletURL = url.resolveScript({
                    deploymentId: DEPLOYMENT_ID,
                    scriptId: SCRIPT_ID,
                    params: params
                });

                window.onbeforeunload = null;
                window.location.href = suiteletURL;
            } catch (errFieldChanged) {
                showError('Unable to update filters', errFieldChanged.message);
            }
        }

        const getBudgetCategoryType = (budgetCategoryId) => {
            try {
                let loadBudgetCategory = record.load({
                    type: 'budgetcategory',
                    id: budgetCategoryId
                });

                let isGlobal = loadBudgetCategory.getValue('budgettype');
                if (isGlobal == true || isGlobal == 'T') {
                    return 'Global';
                } else {
                    return '';
                }
            } catch (errGetBudgetCategoryType) {
                showError('Unable to get budget ctegory type', errGetBudgetCategoryType.message);
            }
        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {
            try {
                let fieldId = scriptContext.fieldId;
                let objCurrentRecord = currentRecord.get();

                if (fieldId == 'custpage_budgetcategory') {
                    let budgetCategoryId = objCurrentRecord.getValue('custpage_budgetcategory');

                    objCurrentRecord.setValue({
                        fieldId: 'custpage_budgetcategorytype',
                        value: getBudgetCategoryType(budgetCategoryId)
                    });
                }

                return true;
            } catch (errValidateField) {
                showError('Unable to validate field', errValidateField.message);
            }
        }

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

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            markAll: markAll,
            unMarkAll: unMarkAll,
            distribute: distribute,
            fill: fill,
            saveBudget: saveBudget,
            validateField: validateField
        };

    });