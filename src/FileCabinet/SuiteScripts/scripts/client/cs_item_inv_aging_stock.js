/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * Client-side companion to sl_item_inv_aging_stock.js.
 *   - Apply Filters : validates the inputs, reloads the Suitelet, which starts the
 *                     Map/Reduce calculation
 *   - pageInit      : while the calculation runs, polls its status and reloads the
 *                     page when it finishes
 *   - Extract       : downloads the CSV built from the result currently on screen
 */
define(['N/currentRecord', 'N/url', 'N/ui/dialog'],
    (currentRecord, url, dialog) => {

        // Must match the field IDs / parameter names used by the Suitelet
        const PARAMS = {
            subsidiary: 'subsidiary',
            fromDate: 'from_date',
            toDate: 'to_date',
            exportCsv: 'export',
            runKey: 'runkey',
            taskId: 'taskid',
            action: 'action'
        };

        // Suitelet script + deployment IDs. Adjust to your account.
        const SUITELET_SCRIPT_ID = 'customscript_sl_item_inv_aging_stock';
        const SUITELET_DEPLOYMENT_ID = 'customdeploy_sl_item_inv_aging_stock';

        const POLL_MS = 5000;

        /**
         * Reads and validates the filter fields.
         * Returns the URL parameters, or null after showing an error.
         */
        function getValidatedParams() {
            const record = currentRecord.get();

            const subsidiaryId = record.getValue({ fieldId: PARAMS.subsidiary });
            const fromValue = record.getValue({ fieldId: PARAMS.fromDate });  // Date object
            const toValue = record.getValue({ fieldId: PARAMS.toDate });      // Date object
            // Text in the user's own date format (DD/MM/YYYY); the Suitelet parses it
            const fromText = record.getText({ fieldId: PARAMS.fromDate });
            const toText = record.getText({ fieldId: PARAMS.toDate });

            if (!subsidiaryId) { showError('Subsidiary is required.'); return null; }
            if (!fromValue || !fromText) { showError('From Date is required.'); return null; }
            if (!toValue || !toText) { showError('To Date is required.'); return null; }

            if (!(fromValue instanceof Date) || !(toValue instanceof Date) ||
                isNaN(fromValue.getTime()) || isNaN(toValue.getTime())) {
                showError('Enter valid date values.');
                return null;
            }

            if (fromValue.getTime() > toValue.getTime()) {
                showError('From Date cannot be later than To Date.');
                return null;
            }

            return {
                [PARAMS.subsidiary]: subsidiaryId,
                [PARAMS.fromDate]: fromText,
                [PARAMS.toDate]: toText
            };
        }

        function suiteletUrl(params) {
            return url.resolveScript({
                scriptId: SUITELET_SCRIPT_ID,
                deploymentId: SUITELET_DEPLOYMENT_ID,
                params
            });
        }

        function applyFilters() {
            const params = getValidatedParams();
            if (!params) return;

            window.onbeforeunload = null;
            window.location.href = suiteletUrl(params);
        }

        // ---------------------------------------------------------------------
        // Progress polling (only active on the "building report" page)
        // ---------------------------------------------------------------------
        function pageInit() {
            const query = new URLSearchParams(window.location.search);
            const taskId = query.get(PARAMS.taskId);

            if (taskId && document.getElementById('ia-status')) {
                poll(taskId);
            }
            return true;
        }

        function poll(taskId) {
            const statusUrl = suiteletUrl({ [PARAMS.action]: 'status', [PARAMS.taskId]: taskId });

            fetch(statusUrl, { credentials: 'same-origin' })
                .then((res) => res.json())
                .then((data) => {
                    if (data.status === 'PENDING' || data.status === 'PROCESSING') {
                        const label = document.getElementById('ia-status-text');
                        if (label) {
                            const stage = data.stage ? `Stage: ${String(data.stage).toLowerCase()}` : 'Running';
                            const pct = (typeof data.percent === 'number') ? ` (${Math.round(data.percent)}%)` : '';
                            label.textContent = stage + pct;
                        }
                        window.setTimeout(() => poll(taskId), POLL_MS);
                        return;
                    }

                    // COMPLETE / FAILED / UNKNOWN: the Suitelet decides what to render
                    window.onbeforeunload = null;
                    window.location.reload();
                })
                .catch(() => {
                    window.setTimeout(() => poll(taskId), POLL_MS * 2);
                });
        }

        // ---------------------------------------------------------------------
        // CSV extract - uses the result already on screen, no recalculation
        // ---------------------------------------------------------------------
        function extractCsv() {
            const query = new URLSearchParams(window.location.search);
            const runKey = query.get(PARAMS.runKey);

            if (!runKey || !document.getElementById('ia-report')) {
                showError('Run the report first (Apply Filters), then click Extract.');
                return;
            }

            fetch(suiteletUrl({ [PARAMS.exportCsv]: 'T', [PARAMS.runKey]: runKey }),
                { credentials: 'same-origin' })
                .then((res) => {
                    const disposition = res.headers.get('Content-Disposition') || '';

                    if (/attachment/i.test(disposition)) {
                        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
                        const name = match ? decodeURIComponent(match[1]) : 'Item_Inventory_Aging.csv';
                        return res.blob().then((blob) => saveBlob(blob, name));
                    }

                    // Not a file: the Suitelet answered with a JSON error
                    return res.text().then((text) => {
                        let message = 'The CSV could not be generated.';
                        try { message = JSON.parse(text).error || message; } catch (e) { /* keep default */ }
                        showError(message, 'Extract Error');
                    });
                })
                .catch((error) => {
                    showError(`The CSV could not be downloaded: ${error.message || error}`, 'Extract Error');
                });
        }

        function saveBlob(blob, name) {
            const link = document.createElement('a');
            const objectUrl = window.URL.createObjectURL(blob);

            link.href = objectUrl;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
        }

        function showError(message, title) {
            dialog.alert({
                title: title || 'Validation Error',
                message
            });
        }

        return {
            pageInit,
            applyFilters,
            extractCsv
        };
    });