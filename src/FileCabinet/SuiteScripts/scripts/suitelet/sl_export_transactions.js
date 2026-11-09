/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/format', 'N/log'], (serverWidget, search, format, log) => {

    const STYLE = {
        CSS: `
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: #F0F2F5;
                    color: #1A1D23;
                }
                .rpt-wrapper { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }
                .rpt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
                .rpt-title { font-size: 26px; font-weight: 700; color: #0F1724; letter-spacing: -0.5px; }
                .rpt-subtitle { font-size: 13px; color: #6B7280; margin-top: 4px; }
                .rpt-badge { display: inline-flex; align-items: center; gap: 6px; background: #1E3A5F; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; }
                
                .rpt-filter-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
                .rpt-filter-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #9CA3AF; margin-bottom: 16px; }
                .rpt-filter-row { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
                .rpt-field { display: flex; flex-direction: column; gap: 6px; }
                .rpt-field label { font-size: 12px; font-weight: 600; color: #374151; letter-spacing: 0.2px; }
                .rpt-field input[type="date"] { border: 1.5px solid #D1D5DB; border-radius: 8px; padding: 9px 14px; font-size: 14px; color: #1A1D23; background: #FAFAFA; outline: none; transition: border-color 0.15s; min-width: 170px; }
                .rpt-field input[type="date"]:focus { border-color: #1E3A5F; background: #fff; }
                .rpt-btn-run { display: inline-flex; align-items: center; gap: 8px; background: #1E3A5F; color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; letter-spacing: 0.2px; }
                .rpt-btn-run:hover { background: #16304F; }
                .rpt-btn-run:active { transform: scale(0.98); }
                .rpt-btn-export { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #1E3A5F; border: 1.5px solid #1E3A5F; border-radius: 8px; padding: 9px 18px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; text-decoration: none; }

                .rpt-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
                .rpt-kpi { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px 22px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
                .rpt-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
                .rpt-kpi.inv::before { background: #3B82F6; }
                .rpt-kpi.je::before { background: #8B5CF6; }
                .rpt-kpi.total::before { background: #10B981; }
                .rpt-kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: #9CA3AF; margin-bottom: 8px; }
                .rpt-kpi-count { font-size: 11px; color: #6B7280; margin-top: 4px; }
                .rpt-kpi-value { font-size: 22px; font-weight: 700; color: #0F1724; letter-spacing: -0.5px; }

                .rpt-table-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
                .rpt-table-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid #F3F4F6; }
                .rpt-table-title { font-size: 14px; font-weight: 700; color: #0F1724; }
                .rpt-row-count { font-size: 12px; color: #6B7280; background: #F3F4F6; padding: 3px 10px; border-radius: 20px; }
                .rpt-search-box { border: 1.5px solid #E5E7EB; border-radius: 8px; padding: 7px 12px; font-size: 13px; color: #374151; outline: none; width: 220px; transition: border-color 0.15s; }
                .rpt-search-box:focus { border-color: #1E3A5F; }
                .rpt-table-wrap { overflow-x: auto; }
                table.rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                table.rpt-table thead tr { background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
                table.rpt-table thead th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: #6B7280; white-space: nowrap; cursor: pointer; user-select: none; }
                table.rpt-table thead th:hover { color: #1E3A5F; }
                table.rpt-table thead th.sort-asc::after { content: ' ▲'; font-size: 9px; }
                table.rpt-table thead th.sort-desc::after { content: ' ▼'; font-size: 9px; }
                table.rpt-table tbody tr { border-bottom: 1px solid #F3F4F6; transition: background 0.1s; }
                table.rpt-table tbody tr:hover { background: #F8FAFF; }
                table.rpt-table tbody tr:last-child { border-bottom: none; }
                table.rpt-table td { padding: 11px 16px; color: #374151; vertical-align: middle; }
                table.rpt-table td.rpt-tranid { font-weight: 600; color: #1E3A5F; }
                table.rpt-table td.rpt-amount { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
                table.rpt-table td.rpt-amount.neg { color: #DC2626; }
                table.rpt-table td.rpt-amount.pos { color: #059669; }
                
                .rpt-pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 22px; border-top: 1px solid #F3F4F6; font-size: 12px; color: #6B7280; }
                .rpt-pagination-btns { display: flex; gap: 6px; }
                .rpt-pagination-btns button { border: 1px solid #E5E7EB; background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; color: #374151; transition: background 0.1s; }
                .rpt-pagination-btns button:hover { background: #F3F4F6; }
                .rpt-pagination-btns button.active { background: #1E3A5F; color: #fff; border-color: #1E3A5F; }
                .rpt-pagination-btns button:disabled { opacity: 0.4; cursor: not-allowed; }
                .rpt-empty { text-align: center; padding: 60px 20px; color: #9CA3AF; }
                .rpt-empty-icon { font-size: 40px; margin-bottom: 12px; }
                .rpt-empty-msg { font-size: 15px; font-weight: 600; color: #374151; }
                .rpt-empty-sub { font-size: 13px; margin-top: 6px; }
                .rpt-loading { display: none; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #6B7280; font-size: 14px; }
                .spinner { width: 22px; height: 22px; border: 3px solid #E5E7EB; border-top-color: #1E3A5F; border-radius: 50%; animation: spin 0.7s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @media (max-width: 768px) { .rpt-filter-row { flex-direction: column; align-items: stretch; } .rpt-kpi-row { grid-template-columns: 1fr 1fr; } }
            </style>
        `
    };

    const onRequest = (context) => {
        const { request, response } = context;
        try {
            if (request.parameters.export_csv === 'true') {
                handleExportCSV(request, response);
            } else if (request.method === 'GET') {
                handleGet(request, response);
            } else {
                handleGet(request, response);
            }
        } catch (errOnRequest) {
            response.write(`Error: ${errOnRequest.message}`);
            log.debug('errOnRequest', errOnRequest);
        }
    };

    // Helper to build the base search safely
    const buildBaseSearch = (dateFrom, dateTo) => {
        const nsDateFrom = toNSDateFormat(dateFrom);
        const nsDateTo = toNSDateFormat(dateTo);

        return search.create({
            type: search.Type.TRANSACTION,
            filters: [
                ["type", search.Operator.ANYOF, "CustInvc"],
                "AND",
                ["trandate", search.Operator.WITHIN, nsDateFrom, nsDateTo],
                "AND",
                ["posting", search.Operator.IS, 'T'],
                "AND",
                ["account", search.Operator.ANYOF, '54', '396', '935', '957', '397', '853', '934', '918', '951', '776', '401']
            ],
            columns: [
                search.createColumn({ name: "tranid", label: "Document Number" }),
                search.createColumn({ name: "trandate", label: "Date" }),
                search.createColumn({ name: "entity", label: "Name" }),
                search.createColumn({ name: "item", label: "Item" }),
                search.createColumn({ name: "displayname", join: "item", label: "Memo" }),
                search.createColumn({ name: "quantity", label: "Quantity" }),
                search.createColumn({ name: "rate", label: "Item Rate" }),
                search.createColumn({ name: "custbody_payment_method", label: "NiceOne Payment Method" })
            ]
        });
    };

    const handleExportCSV = (request, response) => {
        const dateFrom = request.parameters.date_from || getDefaultDateFrom();
        const dateTo = request.parameters.date_to || getTodayDate();
        const fileIndex = parseInt(request.parameters.file_index || '0', 10);

        // MUST match the frontend CHUNK size exactly 
        const CHUNK = 1000000;

        const searchObj = buildBaseSearch(dateFrom, dateTo);
        const pagedData = searchObj.runPaged({ pageSize: 1000 });
        const totalRows = pagedData.count;

        if (totalRows === 0) {
            response.write('No data found for export.');
            return;
        }

        const totalFiles = Math.ceil(totalRows / CHUNK);
        const start = fileIndex * CHUNK;
        const end = Math.min(start + CHUNK, totalRows);

        const HEADER = ['Invoice #', 'Date', 'Customer ID', 'Item ID', 'Description', 'Quantity', 'Rate', 'Payment Method ID'];
        const csvLines = [HEADER.map(h => '"' + h + '"').join(',')];

        const startPageIndex = Math.floor(start / 1000);
        const endPageIndex = Math.floor((end - 1) / 1000);

        let globalIdx = startPageIndex * 1000;

        for (let i = startPageIndex; i <= endPageIndex && i < pagedData.pageRanges.length; i++) {
            let page = pagedData.fetch({ index: i });
            page.data.forEach(result => {
                if (globalIdx >= start && globalIdx < end) {
                    const row = [
                        result.getValue('tranid') || '',
                        formatNSDate(result.getValue('trandate')) || '',
                        result.getValue('entity') || '',
                        result.getValue('item') || '',
                        result.getValue({ name: 'displayname', join: 'item' }) || '',
                        result.getValue('quantity') || '0',
                        result.getValue('rate') || '0',
                        result.getValue('custbody_payment_method') || ''
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
                    csvLines.push(row.join(','));
                }
                globalIdx++;
            });
        }

        const suffix = totalFiles > 1 ? `_part${fileIndex + 1}of${totalFiles}` : '';
        const filename = `invoices_${dateFrom}_${dateTo}${suffix}.csv`.replace(/\//g, '-');

        response.setHeader({ name: 'Content-Type', value: 'text/csv; charset=utf-8' });
        response.setHeader({ name: 'Content-Disposition', value: `attachment; filename="${filename}"` });
        response.write(csvLines.join('\n'));
    };

    const handleGet = (request, response) => {
        try {
            const form = serverWidget.createForm({ title: 'Transaction Report' });
            const htmlField = form.addField({
                id: 'custpage_report_html',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Report'
            });

            const dateFrom = request.parameters.date_from || getDefaultDateFrom();
            const dateTo = request.parameters.date_to || getTodayDate();
            const pageId = parseInt(request.parameters.page_id || '1', 10);

            let resultsHtml = '';
            if (request.parameters.run === '1') {
                try {
                    const data = runSearch(dateFrom, dateTo, pageId);
                    resultsHtml = buildResultsHtml(data, pageId);
                } catch (e) {
                    log.error({ title: 'Query Error', details: e });
                    resultsHtml = `<div class="rpt-error-banner" style="display:block; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 16px 20px; color: #DC2626; font-size: 13px; margin-bottom: 20px;">⚠️ Query failed: ${e.message}</div>`;
                }
            }

            htmlField.defaultValue = buildPageHtml(dateFrom, dateTo, resultsHtml, request);
            response.writePage(form);
        } catch (errHandleGet) {
            log.debug('errHandleGet', errHandleGet);
        }
    };

    const runSearch = (dateFrom, dateTo, pageId) => {
        try {
            const searchObj = buildBaseSearch(dateFrom, dateTo);
            const PAGE_SIZE = 1000;
            const pagedData = searchObj.runPaged({ pageSize: PAGE_SIZE });

            let pageData = null;
            if (pagedData.count > 0) {
                const targetPageId = pageId <= pagedData.pageRanges.length ? pageId - 1 : 0;
                pageData = pagedData.fetch({ index: targetPageId });
            }

            return {
                rows: pageData ? pageData.data : [],
                totalRows: pagedData.count,
                totalPages: pagedData.pageRanges.length,
                currentPage: pageId
            };
        } catch (errRunSearch) {
            log.debug('errRunSearch', errRunSearch);
            throw errRunSearch;
        }
    };

    const buildPageHtml = (dateFrom, dateTo, resultsHtml, request) => {
        const scriptUrl = '/app/site/hosting/scriptlet.nl';
        const scriptId = getScriptParam(request);
        const deployId = getDeployParam(request);

        return `
            ${STYLE.CSS}
            <div class="rpt-wrapper">
                <div class="rpt-header">
                    <div class="rpt-header-left">
                        <div class="rpt-title">Transaction Report</div>
                        <div class="rpt-subtitle">Invoice Lines Detail Report</div>
                    </div>
                    <span class="rpt-badge">⬡ Finance</span>
                </div>

                <div class="rpt-filter-card">
                    <div class="rpt-filter-title">Filter Parameters (Maximum 3 Months Span)</div>
                    <form method="GET" action="${scriptUrl}" id="rpt-form">
                        <input type="hidden" name="script" value="${scriptId}"/>
                        <input type="hidden" name="deploy" value="${deployId}"/>
                        <input type="hidden" name="run" value="1"/>
                        <input type="hidden" name="page_id" id="page_id" value="1"/>
                        <div class="rpt-filter-row">
                            <div class="rpt-field">
                                <label for="date_from">From Date</label>
                                <input type="date" id="date_from" name="date_from" value="${dateFrom}" required onchange="adjustDates('from')"/>
                            </div>
                            <div class="rpt-field">
                                <label for="date_to">To Date</label>
                                <input type="date" id="date_to" name="date_to" value="${dateTo}" required onchange="adjustDates('to')"/>
                            </div>
                            <button type="submit" class="rpt-btn-run" onclick="showLoading()">
                                ▶ Run Report
                            </button>
                            <button type="button" class="rpt-btn-export" onclick="exportCSV()">
                                ↓ Export CSV
                            </button>
                        </div>
                    </form>
                </div>

                <div id="rpt-results">
                    ${resultsHtml}
                </div>

                <div class="rpt-loading" id="rpt-loading">
                    <div class="spinner"></div> Running query...
                </div>
            </div>

            <script>
                function adjustDates(changed) {
                    var fromInput = document.getElementById('date_from');
                    var toInput = document.getElementById('date_to');
                    var fromDate = new Date(fromInput.value);
                    var toDate = new Date(toInput.value);
                    var maxDate = new Date(fromDate);
                    maxDate.setMonth(maxDate.getMonth() + 6);
                    maxDate.setDate(maxDate.getDate() - 1); 
                    
                    if (changed === 'from') {
                        if (toDate > maxDate || toDate < fromDate) {
                            toInput.value = maxDate.toISOString().split('T')[0];
                        }
                    } else if (changed === 'to') {
                        var minDate = new Date(toDate);
                        minDate.setMonth(minDate.getMonth() - 6);
                        minDate.setDate(minDate.getDate() + 1); 
                        if (fromDate < minDate || fromDate > toDate) {
                            fromInput.value = minDate.toISOString().split('T')[0];
                        }
                    }
                }

                function goToPage(pageNum) {
                    document.getElementById('page_id').value = pageNum;
                    document.getElementById('rpt-form').submit();
                    showLoading();
                }

                function showLoading() {
                    var from = document.getElementById('date_from').value;
                    var to = document.getElementById('date_to').value;
                    if (!from || !to) { return; }
                    if (from > to) { alert('From Date cannot be after To Date.'); return false; }
                    document.getElementById('rpt-results').style.display = 'none';
                    document.getElementById('rpt-loading').style.display = 'flex';
                }

                var sortState = { col: -1, asc: true };
                function sortTable(colIndex, isNumeric) {
                    var table = document.getElementById('rpt-data-table');
                    if (!table) return;
                    var tbody = table.querySelector('tbody');
                    var rows = Array.from(tbody.querySelectorAll('tr'));
                    var asc = (sortState.col === colIndex) ? !sortState.asc : true;
                    sortState = { col: colIndex, asc: asc };

                    rows.sort(function(a, b) {
                        var av = a.cells[colIndex] ? a.cells[colIndex].getAttribute('data-val') || a.cells[colIndex].innerText : '';
                        var bv = b.cells[colIndex] ? b.cells[colIndex].getAttribute('data-val') || b.cells[colIndex].innerText : '';
                        if (isNumeric) { return asc ? parseFloat(av||0) - parseFloat(bv||0) : parseFloat(bv||0) - parseFloat(av||0); }
                        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
                    });

                    table.querySelectorAll('th').forEach(function(th) { th.classList.remove('sort-asc','sort-desc'); });
                    var th = table.querySelectorAll('th')[colIndex];
                    if (th) th.classList.add(asc ? 'sort-asc' : 'sort-desc');

                    rows.forEach(function(r) { tbody.appendChild(r); });
                    applySearch();
                }

                function applySearch() {
                    var q = (document.getElementById('rpt-search') ? document.getElementById('rpt-search').value : '').toLowerCase();
                    var table = document.getElementById('rpt-data-table');
                    if (!table) return;
                    var rows = Array.from(table.querySelector('tbody').querySelectorAll('tr'));
                    var allRows = rows.filter(function(r) { return !q || r.innerText.toLowerCase().includes(q); });
                    rows.forEach(function(r) { r.style.display = 'none'; });
                    var count = 0;
                    var limit = 25; 
                    allRows.forEach(function(r) { 
                        if(count < limit) {
                            r.style.display = '';
                            count++; 
                        }
                    });
                    var info = document.getElementById('rpt-page-info');
                    if (info) {
                        info.textContent = 'Showing ' + count + ' of ' + allRows.length + ' rows (client-side filtered)';
                    }
                }

                function exportCSV() {
                    var table = document.getElementById('rpt-data-table');
                    var emptyCard = document.querySelector('.rpt-empty');
                    if (!table && !emptyCard) {
                        showExportMsg('No data to export. Please run the report first.', 'error');
                        return;
                    }
                    if (!table) {
                        showExportMsg('No rows found for the selected date range.', 'error');
                        return;
                    }

                    var kpiLines = document.querySelector('.rpt-kpi.je .rpt-kpi-value');
                    var totalRows = kpiLines ? parseInt(kpiLines.textContent.replace(/,/g, ''), 10) : 0;
                    if (isNaN(totalRows) || totalRows === 0) {
                        showExportMsg('No rows to export.', 'error');
                        return;
                    }

                    var CHUNK      = 1000000;
                    var totalFiles = Math.ceil(totalRows / CHUNK);
                    var fromVal    = document.getElementById('date_from').value;
                    var toVal      = document.getElementById('date_to').value;
                    var scriptVal  = document.querySelector('input[name="script"]').value;
                    var deployVal  = document.querySelector('input[name="deploy"]').value;

                    showExportMsg(
                        totalFiles > 1
                            ? 'Preparing ' + totalFiles + ' CSV files (' + totalRows.toLocaleString() + ' rows). Downloads will start shortly...'
                            : 'Preparing CSV download...',
                        'info'
                    );

                    for (var i = 0; i < totalFiles; i++) {
                        var url = '/app/site/hosting/scriptlet.nl'
                            + '?script='      + encodeURIComponent(scriptVal)
                            + '&deploy='      + encodeURIComponent(deployVal)
                            + '&export_csv=true'
                            + '&date_from='   + encodeURIComponent(fromVal)
                            + '&date_to='     + encodeURIComponent(toVal)
                            + '&file_index='  + i
                            + '&total_files=' + totalFiles;

                        (function(fileUrl) {
                            setTimeout(function() {
                                window.open(fileUrl, '_blank');
                            }, i * 800);
                        })(url);
                    }
                }

                function showExportMsg(text, type) {
                    var existing = document.getElementById('rpt-export-msg');
                    if (existing) existing.remove();
                    var div = document.createElement('div');
                    div.id = 'rpt-export-msg';
                    div.textContent = text;
                    div.style.cssText = type === 'error'
                        ? 'background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;border-radius:8px;padding:12px 16px;font-size:13px;margin-bottom:16px;font-family:sans-serif;'
                        : 'background:#EFF6FF;border:1px solid #BFDBFE;color:#1D4ED8;border-radius:8px;padding:12px 16px;font-size:13px;margin-bottom:16px;font-family:sans-serif;';
                    var filterCard = document.querySelector('.rpt-filter-card');
                    if (filterCard) filterCard.after(div);
                    else document.body.prepend(div);
                    setTimeout(function() { if (div.parentNode) div.remove(); }, 5000);
                }

                window.addEventListener('load', function() { 
                    var searchBox = document.getElementById('rpt-search');
                    if(searchBox) {
                        applySearch(); 
                    }
                });
            </script>
        `;
    };

    const buildResultsHtml = (data, pageId) => {
        const { rows, totalRows, totalPages, currentPage } = data;

        if (!rows || rows.length === 0) {
            return `
                <div class="rpt-table-card">
                    <div class="rpt-empty">
                        <div class="rpt-empty-icon">📭</div>
                        <div class="rpt-empty-msg">No transactions found</div>
                        <div class="rpt-empty-sub">Try adjusting your date range or filters.</div>
                    </div>
                </div>
            `;
        }

        const seenInvoices = new Set();

        const mappedRows = rows.map(r => {
            const rate = parseFloat(r.getValue('rate')) || 0;
            const quantity = parseFloat(r.getValue('quantity')) || 0;
            const trandate = r.getValue('trandate');
            const tranid = r.getValue('tranid');

            seenInvoices.add(tranid);

            return {
                tranid: tranid,
                trandate: trandate ? formatNSDate(trandate) : '—',
                entity: r.getText('entity') || '—',
                item: r.getText('item') || '—',
                description: r.getValue({ name: "displayname", join: "item" }) || '—',
                quantity: quantity,
                rate: rate,
                paymentMethod: r.getText('custbody_payment_method') || '—'
            };
        });

        const invCount = seenInvoices.size;

        const kpiHtml = `
            <div class="rpt-kpi-row">
                <div class="rpt-kpi inv">
                    <div class="rpt-kpi-label">Total Invoices</div>
                    <div class="rpt-kpi-value">${invCount}</div>
                    <div class="rpt-kpi-count">unique invoices</div>
                </div>
                <div class="rpt-kpi je">
                    <div class="rpt-kpi-label">Total Lines</div>
                    <div class="rpt-kpi-value">${totalRows}</div>
                    <div class="rpt-kpi-count">across all invoices</div>
                </div>
            </div>
        `;

        const rowsHtml = mappedRows.map(r => {
            const amtClass = r.amount < 0 ? 'neg' : 'pos';
            const entity = (r.entity || '—').replace(/^null\s*/i, '').trim() || '—';

            return `
                <tr>
                    <td class="rpt-tranid">${escHtml(r.tranid || '—')}</td>
                    <td>${escHtml(r.trandate)}</td>
                    <td>${escHtml(entity)}</td>
                    <td>${escHtml(r.item || '—')}</td>
                    <td>${escHtml(r.description || '—')}</td>
                    <td>${escHtml(r.quantity)}</td>
                    <td class="rpt-amount" style="color:#374151;" data-val="${r.rate}">${formatCurrency(r.rate)}</td>
                    <td>${escHtml(r.paymentMethod)}</td>
                </tr>
            `;
        }).join('');

        let paginationHtml = '';
        if (totalPages > 1) {
            let buttonsHtml = '';
            const maxBtns = 5;
            const startP = Math.max(1, currentPage - 2);
            const endP = Math.min(totalPages, startP + maxBtns - 1);

            buttonsHtml += `<button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>«</button>`;
            buttonsHtml += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

            for (let p = startP; p <= endP; p++) {
                buttonsHtml += `<button onclick="goToPage(${p})" class="${p === currentPage ? 'active' : ''}">${p}</button>`;
            }

            buttonsHtml += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
            buttonsHtml += `<button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>»</button>`;

            paginationHtml = `
                <div class="rpt-pagination">
                    <span id="rpt-page-info">Page ${currentPage} of ${totalPages} (Total ${totalRows} rows)</span>
                    <div class="rpt-pagination-btns" id="rpt-page-btns">${buttonsHtml}</div>
                </div>
            `;
        } else {
            paginationHtml = `
                <div class="rpt-pagination">
                    <span id="rpt-page-info">Showing ${rows.length} of ${totalRows} rows</span>
                </div>
            `;
        }

        return `
            ${kpiHtml}
            <div class="rpt-table-card">
                <div class="rpt-table-header">
                    <span class="rpt-table-title">Transaction Lines</span>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <input class="rpt-search-box" id="rpt-search" type="text" placeholder="Search..." oninput="applySearch()"/>
                        <span class="rpt-row-count">${rows.length} rows</span>
                    </div>
                </div>
                <div class="rpt-table-wrap">
                    <table class="rpt-table" id="rpt-data-table">
                        <thead>
                            <tr>
                                <th onclick="sortTable(0,false)">Invoice #</th>
                                <th onclick="sortTable(1,false)">Date</th>
                                <th onclick="sortTable(2,false)">Customer</th>
                                <th onclick="sortTable(3,false)">Item</th>
                                <th onclick="sortTable(4,false)">Description</th>
                                <th onclick="sortTable(5,false)">Quantity</th>
                                <th onclick="sortTable(6,true)" style="text-align:right;">Rate</th>
                                <th onclick="sortTable(5,false)">Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                ${paginationHtml}
            </div>
        `;
    };

    // Utility Functions
    const formatCurrency = (num) => {
        return format.format({
            value: num,
            type: format.Type.CURRENCY
        });
    };

    const escHtml = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const formatNSDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) { return dateStr; }
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const toNSDateFormat = (ymd) => {
        if (!ymd) return '';
        const parts = ymd.split('-');
        if (parts.length !== 3) return ymd;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const getTodayDate = () => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    };

    const getDefaultDateFrom = () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    };

    const getScriptParam = (req) => (req && req.parameters && req.parameters.script) ? req.parameters.script : '';
    const getDeployParam = (req) => (req && req.parameters && req.parameters.deploy) ? req.parameters.deploy : '1';

    return { onRequest };
});
