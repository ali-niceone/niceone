/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * Item Stock Ledger Report  (display layer)
 *
 * The heavy calculation (Beginning / Ending Inv Qty On-hand) runs in mr_item_inv_aging_stock.js
 * (Map/Reduce). This Suitelet only:
 *   1. Apply Filters : validates, submits the Map/Reduce task, redirects to a
 *                      "building report" page that the client script polls
 *   2. On completion : loads the JSON result file and renders the HTML table
 *   3. Extract       : builds the CSV from the same result file (no recalculation)
 *   4. action=status : tiny JSON endpoint the client script polls
 *
 * Script parameter (Suitelet deployment, Free-Form Text):
 *   custscript_aging_result_folder   File Cabinet folder internal id for result files
 */
define(['N/ui/serverWidget', 'N/log', 'N/format', 'N/file', 'N/runtime', 'N/task', 'N/search', 'N/redirect'],
    (serverWidget, log, format, file, runtime, task, search, redirect) => {

        const PARAMS = {
            subsidiary: 'subsidiary',
            fromDate: 'from_date',
            toDate: 'to_date',
            exportCsv: 'export',
            runKey: 'runkey',
            taskId: 'taskid',
            action: 'action'
        };

        // Adjust to your account
        const MR_SCRIPT_ID = 'customscript_mr_item_inv_aging_stock';
        const MR_DEPLOYMENT_ID = 'customdeploy_mr_item_inv_aging_stock_2';
        const FOLDER_PARAM = 'custscript_aging_result_folder';
        const RESULT_PREFIX = 'item_inv_aging_';

        // ---------------------------------------------------------------------
        // Entry point
        // ---------------------------------------------------------------------
        const onRequest = (context) => {
            const request = context.request;
            const response = context.response;
            const p = request.parameters;

            if (p[PARAMS.action] === 'status') {
                writeStatus(response, p[PARAMS.taskId]);
                return;
            }

            if (p[PARAMS.exportCsv] === 'T') {
                writeExport(response, p[PARAMS.runKey]);
                return;
            }

            const filters = {
                subsidiaryId: p[PARAMS.subsidiary] || '',
                fromDate: p[PARAMS.fromDate] || '',
                toDate: p[PARAMS.toDate] || ''
            };
            const runKey = p[PARAMS.runKey] || '';
            const taskId = p[PARAMS.taskId] || '';

            const form = serverWidget.createForm({
                title: 'Item Stock Ledger Report'
            });
            form.clientScriptModulePath = '../client/cs_item_inv_aging_stock.js';

            addFilterFields(form, filters);

            form.addButton({
                id: 'custpage_apply_filters',
                label: 'Apply Filters',
                functionName: 'applyFilters()'
            });
            form.addButton({
                id: 'custpage_extract_csv',
                label: 'Extract',
                functionName: 'extractCsv()'
            });

            // First load with nothing selected: instructions only
            if (!filters.subsidiaryId && !filters.fromDate && !filters.toDate) {
                addHtmlField(form, 'custpage_instruction', instructionHtml());
                response.writePage(form);
                return;
            }

            const validationError = validateFilters(filters);
            if (validationError) {
                addHtmlField(form, 'custpage_message', messageHtml(validationError));
                response.writePage(form);
                return;
            }

            // Fresh Apply Filters: start the calculation, then redirect so a browser
            // refresh never submits a second task
            if (!runKey) {
                try {
                    redirectToRun(filters);
                    return;
                } catch (error) {
                    log.error({ title: 'Inventory Aging - task submit failed', details: error });
                    addHtmlField(
                        form,
                        'custpage_message',
                        messageHtml(`The report could not be started: ${error.message || error}`)
                    );
                    response.writePage(form);
                    return;
                }
            }

            // A run exists: show progress, the error, or the result
            try {
                let state = '';
                if (taskId) {
                    try {
                        state = task.checkStatus({ taskId }).status;
                    } catch (e) {
                        // Old task ids age out; fall back to looking for the result file
                        log.debug({ title: 'checkStatus failed', details: e });
                    }
                }

                if (state === task.TaskStatus.PENDING || state === task.TaskStatus.PROCESSING) {
                    addHtmlField(form, 'custpage_wait', waitingHtml());
                } else if (state === task.TaskStatus.FAILED) {
                    addHtmlField(
                        form,
                        'custpage_message',
                        messageHtml('The calculation failed. Check the Map/Reduce deployment\'s ' +
                            'Execution Log, then click Apply Filters to run it again.')
                    );
                } else {
                    const report = loadResult(runKey);
                    if (!report) {
                        addHtmlField(
                            form,
                            'custpage_message',
                            messageHtml('The result file was not found (it may have expired). ' +
                                'Click Apply Filters to run the report again.')
                        );
                    } else {
                        if (report.errorCount) {
                            addHtmlField(form, 'custpage_warning', warningHtml(report));
                        }
                        addHtmlField(form, 'custpage_report', reportHtml(report, filters));
                    }
                }
            } catch (error) {
                log.error({ title: 'Inventory Aging Error', details: error });
                addHtmlField(
                    form,
                    'custpage_message',
                    messageHtml(`The report could not be displayed: ${error.message || error}`)
                );
            }

            response.writePage(form);
        };

        // ---------------------------------------------------------------------
        // Map/Reduce submission, status and result file
        // ---------------------------------------------------------------------
        function redirectToRun(filters) {
            const subsidiaryId = Number(filters.subsidiaryId);
            const fromIso = toIsoDate(parseUiDate(filters.fromDate));
            const toIso = toIsoDate(parseUiDate(filters.toDate));

            const folderId = runtime.getCurrentScript().getParameter({ name: FOLDER_PARAM });
            if (!folderId) {
                throw new Error(`Suitelet deployment parameter ${FOLDER_PARAM} is not set.`);
            }

            const runKey = `${Date.now()}_${subsidiaryId}`;

            const mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: MR_SCRIPT_ID,
                deploymentId: MR_DEPLOYMENT_ID,
                params: {
                    custscript_stk_subsidiary: String(subsidiaryId),
                    custscript_stk_from_iso: fromIso,
                    custscript_stk_to_iso: toIso,
                    custscript_stk_run_key: runKey,
                    custscript_stk_folder_id: String(folderId)
                }
            });
            const taskId = mrTask.submit();

            const script = runtime.getCurrentScript();
            redirect.toSuitelet({
                scriptId: script.id,
                deploymentId: script.deploymentId,
                parameters: {
                    [PARAMS.subsidiary]: String(filters.subsidiaryId),
                    [PARAMS.fromDate]: filters.fromDate,
                    [PARAMS.toDate]: filters.toDate,
                    [PARAMS.runKey]: runKey,
                    [PARAMS.taskId]: taskId
                }
            });
        }

        function writeStatus(response, taskId) {
            response.setHeader({ name: 'Content-Type', value: 'application/json' });
            try {
                const status = task.checkStatus({ taskId: String(taskId || '') });
                let percent = null;
                try { percent = status.getPercentageCompleted(); } catch (e) { /* optional */ }
                response.write(JSON.stringify({
                    status: status.status,
                    stage: status.stage || '',
                    percent
                }));
            } catch (e) {
                response.write(JSON.stringify({ status: 'UNKNOWN', error: String(e.message || e) }));
            }
        }

        function loadResult(runKey) {
            if (!/^[0-9_]+$/.test(String(runKey))) return null;

            const folderId = runtime.getCurrentScript().getParameter({ name: FOLDER_PARAM });
            if (!folderId) throw new Error(`Suitelet deployment parameter ${FOLDER_PARAM} is not set.`);

            let fileId = null;
            search.create({
                type: 'file',
                filters: [
                    ['name', 'is', `${RESULT_PREFIX}${runKey}.json`], 'AND',
                    ['folder', 'anyof', folderId]
                ],
                columns: ['internalid']
            }).run().each((r) => {
                fileId = r.id;
                return false;
            });

            if (!fileId) return null;
            return JSON.parse(file.load({ id: fileId }).getContents());
        }

        function writeExport(response, runKey) {
            try {
                const report = loadResult(runKey);
                if (!report) throw new Error('The result file was not found. Run the report again.');
                response.writeFile({ file: buildCsvFile(report), isInline: false });
            } catch (error) {
                log.error({ title: 'CSV Extract Error', details: error });
                response.setHeader({ name: 'Content-Type', value: 'application/json' });
                response.write(JSON.stringify({
                    error: `The CSV could not be generated: ${error.message || error}`
                }));
            }
        }

        function waitingHtml() {
            return '<div id="ia-status" style="padding:14px;color:#243b53;font-size:13px;">' +
                '<b>Building the report&hellip;</b> This runs in the background and can take a few ' +
                'minutes for large subsidiaries. This page refreshes itself when it is ready.' +
                '<div id="ia-status-text" style="margin-top:6px;color:#52606d;">Waiting to start&hellip;</div>' +
                '</div>';
        }

        function warningHtml(report) {
            const details = (report.errors || []).slice(0, 5).map(escapeHtml).join('<br>');
            return '<div style="padding:10px;margin:6px 0;border:1px solid #f0b429;background:#fffbea;' +
                'color:#8d2b0b;font-size:12px;"><b>Warning:</b> ' + report.errorCount +
                ' error(s) occurred while building this report, so some items may be missing. ' +
                'Check the Map/Reduce Execution Log.' + (details ? '<br>' + details : '') + '</div>';
        }

        // ---------------------------------------------------------------------
        // Form
        // ---------------------------------------------------------------------
        function addFilterFields(form, values) {
            const subsidiary = form.addField({
                id: PARAMS.subsidiary,
                type: serverWidget.FieldType.SELECT,
                label: 'Subsidiary',
                source: 'subsidiary'
            });
            const fromDate = form.addField({
                id: PARAMS.fromDate,
                type: serverWidget.FieldType.DATE,
                label: 'From Date'
            });
            const toDate = form.addField({
                id: PARAMS.toDate,
                type: serverWidget.FieldType.DATE,
                label: 'To Date'
            });

            subsidiary.isMandatory = true;
            fromDate.isMandatory = true;
            toDate.isMandatory = true;

            if (values.subsidiaryId) subsidiary.defaultValue = values.subsidiaryId;
            if (values.fromDate) fromDate.defaultValue = values.fromDate;
            if (values.toDate) toDate.defaultValue = values.toDate;
        }

        function addHtmlField(form, id, html) {
            const field = form.addField({
                id,
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            });
            field.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW });
            field.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTROW });
            field.defaultValue = html;
        }

        function instructionHtml() {
            return '<div style="padding:10px;color:#555;">Select a Subsidiary, From Date and ' +
                'To Date, then click <b>Apply Filters</b>. Use <b>Extract</b> to download the ' +
                'result as a CSV file.</div>';
        }

        function messageHtml(message) {
            return '<div style="padding:10px;color:#b00020;font-weight:bold;">' +
                escapeHtml(message) + '</div>';
        }

        // ---------------------------------------------------------------------
        // HTML report
        // ---------------------------------------------------------------------
        function reportHtml(report, filters) {
            const t = report.totals;

            const css = `
                <style>
                .ia-wrap{font-family:Open Sans,Helvetica,Arial,sans-serif;color:#1f2933;margin:6px 0 20px;max-width:900px;}
                .ia-meta{font-size:12px;color:#52606d;margin:0 0 10px;}
                .ia-cards{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 14px;}
                .ia-card{flex:1 1 150px;background:#fff;border:1px solid #d9e2ec;border-left:4px solid #2c6ecb;border-radius:4px;padding:10px 14px;}
                .ia-card .l{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#52606d;}
                .ia-card .v{font-size:20px;font-weight:600;margin-top:2px;}
                .ia-scroll{max-height:70vh;overflow:auto;border:1px solid #d9e2ec;border-radius:4px;background:#fff;}
                .ia-table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;}
                .ia-table th,.ia-table td{padding:7px 12px;border-bottom:1px solid #e4e7eb;white-space:nowrap;}
                .ia-table thead th{background:#243b53;color:#fff;font-weight:600;text-align:right;position:sticky;top:0;z-index:2;}
                .ia-table th.item,.ia-table td.item{text-align:left;}
                .ia-table td.item{font-weight:600;}
                .ia-table tbody tr:nth-child(even) td{background:#f5f7fa;}
                .ia-table tbody tr:hover td{background:#e6f0fb;}
                .ia-table td.n{text-align:right;font-variant-numeric:tabular-nums;}
                .ia-table td.z{color:#9aa5b1;}
                .ia-table td.neg{color:#b00020;}
                .ia-table td.end{font-weight:600;}
                .ia-table tfoot td{position:sticky;bottom:0;background:#e4eaf1;font-weight:700;border-top:2px solid #243b53;z-index:2;}
                .ia-empty{padding:16px;color:#52606d;}
                </style>`;

            const cards = [
                ['Beginning Inv Qty On-hand', t.beginningQty],
                ['Ending Inv Qty On-hand', t.endingQty],
                ['Items', report.rows.length]
            ].map(([label, value]) =>
                `<div class="ia-card">` +
                `<div class="l">${label}</div>` +
                `<div class="v">${formatQty(value, true)}</div>` +
                `</div>`
            ).join('');

            const meta = `<div class="ia-meta">Period: <b>${escapeHtml(filters.fromDate)}</b> to ` +
                `<b>${escapeHtml(filters.toDate)}</b> &middot; ${report.rows.length} item(s)` +
                `${report.generatedAt ? ` &middot; generated: <b>${escapeHtml(report.generatedAt)}</b>` : ''}</div>`;

            if (report.rows.length === 0) {
                return `${css}<div class="ia-wrap" id="ia-report">${meta}<div class="ia-empty">No inventory ` +
                    `balances or movements were found for the selected subsidiary and dates.</div></div>`;
            }

            const head =
                '<thead><tr>' +
                '<th class="item">Item</th>' +
                '<th>Beginning Inv Qty On-hand</th>' +
                '<th>Ending Inv Qty On-hand</th>' +
                '</tr></thead>';

            const body = report.rows.map((row) =>
                `<tr><td class="item">${escapeHtml(row.item)}</td>` +
                numCell(row.beginningQty) +
                numCell(row.endingQty, 'end') +
                '</tr>'
            ).join('');

            const foot =
                '<tfoot><tr>' +
                '<td class="item">Total</td>' +
                numCell(t.beginningQty) +
                numCell(t.endingQty, 'end') +
                '</tr></tfoot>';

            return `${css}<div class="ia-wrap" id="ia-report">${meta}<div class="ia-cards">${cards}</div>` +
                `<div class="ia-scroll"><table class="ia-table">${head}<tbody>${body}</tbody>${foot}</table></div></div>`;
        }

        function numCell(value, extraClass) {
            const n = roundQty(value);
            const classes = ['n'];
            if (n === 0) classes.push('z');
            if (n < 0) classes.push('neg');
            if (extraClass) classes.push(extraClass);
            return `<td class="${classes.join(' ')}">${formatQty(n, false)}</td>`;
        }

        // ---------------------------------------------------------------------
        // CSV extract
        // ---------------------------------------------------------------------
        function buildCsvFile(report) {
            const header = [
                'Item',
                'Beginning Inv Qty On-hand',
                'Ending Inv Qty On-hand'
            ];

            const lines = [header.map(csvQuote).join(',')];

            report.rows.forEach((row) => {
                lines.push([
                    csvText(row.item),
                    row.beginningQty,
                    row.endingQty
                ].join(','));
            });

            const t = report.totals;
            lines.push([csvText('Total'), t.beginningQty, t.endingQty].join(','));

            const fromIso = report.meta.fromIso;
            const toIso = report.meta.toIso;

            return file.create({
                name: `Item_Stock_Ledger_${fromIso}_to_${toIso}.csv`,
                fileType: file.Type.CSV,
                contents: '\uFEFF' + lines.join('\r\n')
            });
        }

        function csvQuote(value) {
            return '"' + String(value).replace(/"/g, '""') + '"';
        }

        // Text cell; neutralise values Excel would treat as formulas
        function csvText(value) {
            let text = String(value);
            if (/^[=+@\t\r]/.test(text)) text = "'" + text;
            return csvQuote(text);
        }

        // ---------------------------------------------------------------------
        // Validation
        // ---------------------------------------------------------------------
        function validateFilters(filters) {
            if (!filters.subsidiaryId) return 'Subsidiary is required.';
            if (!filters.fromDate) return 'From Date is required.';
            if (!filters.toDate) return 'To Date is required.';

            const from = parseUiDate(filters.fromDate);
            const to = parseUiDate(filters.toDate);

            if (!from || !to) return 'Enter valid From Date and To Date values.';
            if (toIsoDate(from) > toIsoDate(to)) {
                return 'From Date cannot be later than To Date.';
            }
            return '';
        }

        // ---------------------------------------------------------------------
        // Date helpers (everything internal is ISO YYYY-MM-DD)
        // ---------------------------------------------------------------------
        // Parses a date typed in the user's own NetSuite format (e.g. DD/MM/YYYY)
        function parseUiDate(value) {
            try {
                const d = format.parse({ value: String(value), type: format.Type.DATE });
                return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
            } catch (e) {
                return null;
            }
        }

        function toIsoDate(date) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        // ---------------------------------------------------------------------
        // Misc helpers
        // ---------------------------------------------------------------------
        function toNumber(value) {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        }

        function roundQty(value) {
            return Math.round(toNumber(value) * 1000000) / 1000000;
        }

        // 1234567.5 -> "1,234,567.5"; zero -> "-" unless showZero
        function formatQty(value, showZero) {
            const n = roundQty(value);
            if (n === 0) return showZero ? '0' : '-';
            const [intPart, decPart] = Math.abs(n).toFixed(4).replace(/\.?0+$/, '').split('.');
            const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return (n < 0 ? '-' : '') + grouped + (decPart ? '.' + decPart : '');
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        return { onRequest };
    });