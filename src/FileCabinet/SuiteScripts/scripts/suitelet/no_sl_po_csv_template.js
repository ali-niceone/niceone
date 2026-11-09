/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/runtime', 'N/url'],
    function (serverWidget, record, search, runtime, url) {

        function onRequest(context) {
            try {
                if (context.request.method === 'GET') {
                    // Success redirect after save
                    if (context.request.parameters.success === 'true' && context.request.parameters.poid) {
                        showSuccessPage(context, context.request.parameters.poid);
                    } else {
                        buildForm(context);
                    }
                } else {
                    processCSV(context);
                }
            } catch (e) {
                showErrorPage(context, e.message || String(e));
            }
        }

        function buildForm(context) {
            let form = serverWidget.createForm({
                title: 'Upload PO CSV'
            });

            // Client script (update path if needed)
            form.clientScriptModulePath = '../client/no_cs_po_csv_template.js';

            // Input group
            form.addFieldGroup({
                id: 'custpage_input_section',
                label: 'Purchase Order Details'
            });

            // Inline HTML header CSS (kept from original)
            form.addField({
                id: 'custpage_fields_header',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
                .fields-container { display:flex; flex-wrap:wrap; gap:20px; margin-bottom:25px; padding:20px; background:#f8f9fa; border-radius:5px; border:1px solid #e0e0e0; }
                .field-item { flex:1; min-width:200px; }
                .required-field::after { content: " *"; color: red; }
                @media (max-width:768px) { .fields-container { flex-direction:column; } }
            </style>
        `;

            // Upload CSV Field
            let uploadFld = form.addField({
                id: 'custpage_upload_file',
                label: 'Upload CSV File',
                type: serverWidget.FieldType.FILE,
                // container: 'custpage_input_section'
            });
            uploadFld.isMandatory = true;
            uploadFld.helpText = 'Select the CSV file containing PO line items (CSV must include headers).';

            // Vendor Field
            let vendorFld = form.addField({
                id: 'custpage_vendor',
                label: 'Vendor',
                type: serverWidget.FieldType.SELECT,
                source: 'vendor',
                container: 'custpage_input_section'
            });
            vendorFld.isMandatory = true;
            vendorFld.helpText = 'Select the vendor for this purchase order';

            // Purchase Serial Field
            let purchaseSerialFld = form.addField({
                id: 'custpage_purchase_serial',
                label: 'Purchase Serial',
                type: serverWidget.FieldType.SELECT,
                source: 'customlist_ap_serial_',
                container: 'custpage_input_section'
            });
            purchaseSerialFld.isMandatory = true;
            purchaseSerialFld.helpText = 'Select the purchase serial number';

            // Employee Field (inline)
            let employeeFld = form.addField({
                id: 'custpage_employee',
                label: 'Employee',
                type: serverWidget.FieldType.SELECT,
                source: 'employee',
                container: 'custpage_input_section'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.INLINE
            });
            employeeFld.isMandatory = true;
            employeeFld.helpText = 'Select the employee associated with this PO';
            employeeFld.defaultValue = runtime.getCurrentUser().id;

            // Delivery Field
            let deliveryFld = form.addField({
                id: 'custpage_delivery',
                label: 'Delivery Path',
                type: serverWidget.FieldType.SELECT,
                source: 'customlist_delivery_path',
                container: 'custpage_input_section'
            });
            deliveryFld.isMandatory = true;
            deliveryFld.helpText = 'Select the delivery path associated with this PO';

            // Location Field (disabled)
            let locationFld = form.addField({
                id: 'custpage_location',
                label: 'Location',
                type: serverWidget.FieldType.SELECT,
                container: 'custpage_input_section'
            });
            locationFld.addSelectOption({ value: '', text: '', isSelected: true });
            locationFld.addSelectOption({ value: 262, text: 'Riyadh' });
            locationFld.addSelectOption({ value: 292, text: 'Jeddah' });
            locationFld.addSelectOption({ value: 360, text: 'Cross Dock to JED' });
            locationFld.addSelectOption({ value: 361, text: 'Cross Dock to RYD' });
            locationFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            locationFld.helpText = 'Select the location associated with this PO';

            let vendorCategoryFld = form.addField({
                id: 'custpage_vendor_category',
                label: 'Vendor Category',
                type: serverWidget.FieldType.SELECT,
                source: 'vendorcategory',
                container: 'custpage_input_section'
            });
            vendorCategoryFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            vendorCategoryFld.helpText = 'Select the vendor category associated with this PO';

            // Action Mode: Create / Update
            /* let modeFld = form.addField({
                id: 'custpage_mode',
                label: 'Action',
                type: serverWidget.FieldType.SELECT,
                container: 'custpage_input_section'
            });
            modeFld.isMandatory = true;
            modeFld.addSelectOption({ value: 'create', text: 'Create Purchase Order', isSelected: true });
            modeFld.addSelectOption({ value: 'update', text: 'Update Purchase Order' });
            modeFld.helpText = 'Choose Create to create a new PO or Update to update an existing PO.'; */

            // Purchase Order select (for update mode)
            /* let poFld = form.addField({
                id: 'custpage_po_id',
                label: 'Purchase Order',
                type: serverWidget.FieldType.SELECT,
                source: 'purchaseorder',
                container: 'custpage_input_section'
            });
            poFld.helpText = 'Select the Purchase Order to update (required when Action = Update).'; */

            // Update mode warning
            /* form.addField({
                id: 'custpage_update_warning',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' ',
                container: 'custpage_input_section'
            }).defaultValue = `
            <div style="background:#fff3cd;border-left:4px solid #ffeeba;padding:10px;border-radius:3px;margin-top:8px;">
              <strong>Update mode rules:</strong>
              <ul style="margin:6px 0 0 18px;padding:0;">
                <li>CSV must include a <code>Line</code> header.</li>
                <li>Every CSV row must contain a non-empty 1-based integer in <code>Line</code>.</li>
                <li>CSV <code>Line</code> (1-based) to update the matching PO line. Out-of-range values will cause a validation error.</li>
              </ul>
            </div>
        `; */

            // CSV Preview and Tax Codes (kept with original logic)
            var taxCodes = getTaxCode();

            form.addField({
                id: 'custpage_preview_section',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'CSV Preview'
            }).defaultValue = `
            <style>
              .preview-row { display:flex; gap:20px; margin-top:20px; }
              .preview-container { padding:20px; background:#fff; border-radius:5px; border:1px solid #e0e0e0; }
              .tax-container { width:100%; height:420px; display:flex; flex-direction:column; }
              .csv-container { width:100%; }
              .preview-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid #4a6fa5; }
              .preview-title { color:#4a6fa5; font-size:16px; font-weight:bold; }
              .search-box { width:100%; padding:6px; margin-bottom:10px; border:1px solid #ccc; border-radius:4px; font-size:12px; }
              .table-scroll { flex:1; overflow-y:auto; border:1px solid #ddd; }
              .csv-preview-table { width:100%; border-collapse:collapse; font-size:12px; }
              .csv-preview-table th { background-color:#4a6fa5; color:white; padding:6px; border:1px solid #ddd; position:sticky; top:0; }
              .csv-preview-table td { padding:6px; border:1px solid #ddd; }
              .record-count { background-color:#4a6fa5; color:white; padding:4px 10px; border-radius:12px; font-size:11px; }
              .validation-section { margin-top:20px; padding:10px; background:#f8f9fa; border-left:4px solid #4a6fa5; }
              .no-file { text-align:center; color:#999; padding:15px; }
            </style>

            <div class="preview-row">
              <div class="preview-container tax-container">
                <div class="preview-header">
                  <div class="preview-title">Tax Codes</div>
                </div>
                <!--<input type="text" id="taxSearch" class="search-box" placeholder="Search tax code...">-->
                <!--<div class="table-scroll">
                  <table class="csv-preview-table" id="taxCodesTable">
                    <thead><tr><th>ID</th><th>Tax Code</th></tr></thead>
                    <tbody><tr><td colspan="2" class="no-file">Loading...</td></tr></tbody>
                  </table>
                </div>-->
                <div class="table-scroll">
                  <table class="csv-preview-table">
                    <thead><tr><th>ID</th><th>Tax Code</th></tr></thead>
                    <tbody>
                    <tr>
                    <td class="no-file">5</td>
                    <td class="no-file">0%</td>
                    </tr>
                    <tr>
                    <td class="no-file">13810</td>
                    <td class="no-file">15%</td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="preview-container csv-container">
                <div class="preview-header">
                  <div class="preview-title">CSV Preview</div>
                  <div id="recordCount" class="record-count">0 records</div>
                </div>

                <div id="csvPreview" class="no-file">No CSV file uploaded yet. Upload a file to see preview.</div>

                <div class="validation-section">
                  <div class="preview-title">Validation Status</div>
                  <div id="csvErrors"><div class="no-file">Upload a CSV file to validate</div></div>
                </div>
              </div>
            </div>

            <script>
              (function () {
                /*window.taxCodesData = ${JSON.stringify(taxCodes)};

                function renderTaxCodes(filter) {
                  var tbody = document.querySelector('#taxCodesTable tbody');
                  if (!window.taxCodesData || window.taxCodesData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="2" class="no-file">No Data</td></tr>';
                    return;
                  }
                  var html = '';
                  var keyword = (filter || '').toLowerCase();
                  for (var i = 0; i < window.taxCodesData.length; i++) {
                    var item = window.taxCodesData[i];
                    if (keyword && item.name.toLowerCase().indexOf(keyword) === -1 && item.id.toString().indexOf(keyword) === -1) {
                      continue;
                    }
                    html += '<tr><td>' + item.id + '</td><td>' + item.name + '</td></tr>';
                  }
                  if (!html) html = '<tr><td colspan="2" class="no-file">No results</td></tr>';
                  tbody.innerHTML = html;
                }

                renderTaxCodes();

                let timeout;
                document.getElementById('taxSearch').addEventListener('input', function () {
                  clearTimeout(timeout);
                  const value = this.value;
                  timeout = setTimeout(function () { renderTaxCodes(value); }, 200);
                });*/

                const input = document.querySelector('input[type="file"]');
                if (!input) return;
                input.addEventListener('change', function () {
                  const reader = new FileReader();
                  reader.onload = function (e) {
                    const csv = e.target.result;
                    const rows = window.parseCSV ? window.parseCSV(csv) : [];
                    const recordCount = Math.max(0, rows.length - 1);
                    document.getElementById('recordCount').textContent =
                        recordCount + ' record' + (recordCount !== 1 ? 's' : '');
                    renderPreview(rows);
                    // Also validate via client function if available
                    if (window.validateCSV) window.validateCSV(csv);
                  };
                  reader.readAsText(this.files[0]);
                });

                function renderPreview(rows) {
                  if (!rows || rows.length === 0) {
                    document.getElementById('csvPreview').innerHTML = '<div class="no-file">CSV file is empty</div>';
                    return;
                  }
                  var html = '<table class="csv-preview-table"><thead><tr>';
                  rows[0].forEach(function (header) { html += '<th>' + header.trim() + '</th>'; });
                  html += '</tr></thead><tbody>';
                  var maxRows = Math.min(10, rows.length - 1);
                  for (var i = 1; i <= maxRows; i++) {
                    html += '<tr>';
                    rows[i].forEach(function (cell) { html += '<td>' + cell.trim() + '</td>'; });
                    html += '</tr>';
                  }
                  html += '</tbody></table>';
                  document.getElementById('csvPreview').innerHTML = html;
                }
              })();
            </script>
        `;

            // CSV Template Tab
            form.addTab({ id: 'custpage_template_tab', label: 'CSV Template' });

            let csvTemplateHTML = `
            <style>
              .template-container { padding:20px; }
              .template-title { color:#4a6fa5; font-size:18px; font-weight:bold; margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid #4a6fa5; }
              .csv-template-table { width:100%; border-collapse:collapse; margin-top:15px; font-family:Arial, sans-serif; font-size:14px; }
              .csv-template-table th { background-color:#4a6fa5; color:#fff; padding:12px; border:1px solid #ddd; text-align:left; }
              .csv-template-table td { padding:12px; border:1px solid #ddd; }
              .example-code { background:#f5f5f5; padding:15px; border-radius:3px; border-left:4px solid #4a6fa5; font-family:monospace; white-space:pre-wrap; overflow-x:auto; }
              .download-btn { display:inline-block; background:#5cb85c; color:white; padding:10px 20px; border-radius:4px; font-weight:bold; text-decoration:none; }
              .required-badge {
                    background-color: #d9534f;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: bold;
                }
                .optional-badge {
                    background-color: #5bc0de;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: bold;
                }
            </style>

            <div class="template-container">
              <div class="template-title">CSV Template Instructions</div>
              <p><strong>Important:</strong> For Update mode, CSV must include a <code>Line</code> column with 1-based line numbers that map to existing PO lines.</p>
              <table class="csv-template-table">
                <thead><tr><th>Column Header</th><th>Description</th><th>Required</th><th>Example</th></tr></thead>
                <tbody>
                  <tr><td><strong>Item ID</strong></td><td>Internal ID of the inventory item</td><td><span class="required-badge">REQUIRED</span></td><td>12345</td></tr>
                  <tr><td><strong>Line</strong></td><td>1-based PO line number (required for Update mode)</td><td><span class="required-badge">REQUIRED for Update</span></td><td>1</td></tr>
                  <tr><td><strong>Quantity</strong></td><td>Number of units to purchase</td><td><span class="required-badge">REQUIRED</span></td><td>10</td></tr>
                  <tr><td><strong>Cost</strong></td><td>Unit cost per item</td><td><span class="required-badge">REQUIRED</span></td><td>25.99</td></tr>
                  <tr><td><strong>Discount</strong></td><td>Percentage discount (like 10%)</td><td><span class="optional-badge">OPTIONAL</span></td><td>10%</td></tr>
                  <tr><td><strong>Tax Code</strong></td><td>Internal ID of the tax code</td><td><span class="required-badge">REQUIRED</span></td><td>1</td></tr>
                </tbody>
              </table>

              <div style="margin-top:20px;">
                <div style="font-weight:bold;margin-bottom:8px;">Example CSV Content (Create):</div>
                <div class="example-code">Item ID,Quantity,Cost,Discount,Tax Code
12345,10,25.99,10%,1
12346,5,15.50,,2</div>

                <div style="font-weight:bold;margin:10px 0 8px;">Example CSV Content (Update):</div>
                <div class="example-code">Item ID,Line,Quantity,Cost,Discount,Tax Code
12345,1,12,25.99,10%,1
12346,2,6,15.50,,2</div>

                <div style="margin-top:10px;text-align:center;">
                  <a href="#" id="downloadTemplate" class="download-btn">Download CSV Template</a>
                </div>
              </div>
            </div>

            <script>
              document.getElementById('downloadTemplate').addEventListener('click', function(e) {
                e.preventDefault();
                const content = "Item ID,Line,Quantity,Cost,Discount,Tax Code\\n12345,1,10,25.99,10%,1\\n12346,2,5,15.50,,2";
                const blob = new Blob([content], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'PO_Template.csv';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              });
            </script>
        `;

            form.addField({
                id: 'custpage_csv_template',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' ',
                container: 'custpage_template_tab'
            }).defaultValue = csvTemplateHTML;

            // Submit button labeled Proceed
            form.addSubmitButton({ label: 'Proceed', id: 'custpage_submit_button' });

            context.response.writePage(form);
        }

        function showSuccessPage(context, poId) {
            let form = serverWidget.createForm({ title: 'Purchase Order Processed Successfully!' });

            form.addField({
                id: 'custpage_success_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
             .success-container { text-align:center; padding:60px 20px; max-width:700px; margin:0 auto; }
             .success-icon { font-size:60px; color:#5cb85c; margin-bottom:20px; }
             .success-title { color:#5cb85c; font-size:28px; font-weight:bold; margin-bottom:20px; }
             .po-id { background:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #5cb85c; font-size:18px; }
             .btn { padding:12px 24px; border-radius:4px; text-decoration:none; font-weight:bold; display:inline-block; min-width:180px; text-align:center; }
             .btn-primary { background:#4a6fa5; color:white; }
             .btn-secondary { background:#6c757d; color:white; }
            </style>

            <div class="success-container">
              <div class="success-icon">✅</div>
              <div class="success-title">Purchase Order processed successfully!</div>
              <div class="po-id"><strong>PO Internal ID:</strong> ${poId}</div>
              <p style="color:#666;">This page will automatically redirect to create another PO in <span id="countdown">10</span> seconds...</p>
              <div style="margin-top:20px;">
                <a href="/app/accounting/transactions/purchord.nl?id=${poId}" target="_blank" class="btn btn-primary">View Purchase Order</a>
                <a href="${getScriptURL(context)}" class="btn btn-secondary">Create / Update Another PO</a>
              </div>
            </div>

            <script>
                // Auto-redirect countdown
                let seconds = 10;
                const countdownElement = document.getElementById('countdown');
                const countdownInterval = setInterval(function() {
                    seconds--;
                    countdownElement.textContent = seconds;

                    if (seconds <= 0) {
                        clearInterval(countdownInterval);
                        window.location.href = "${getScriptURL(context)}";
                    }
                }, 1000);
                
                // Hide loading overlay if it's still showing
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            </script>
        `;

            context.response.writePage(form);
        }

        function showErrorPage(context, errorMessage) {
            let form = serverWidget.createForm({ title: 'Error Processing Purchase Order' });

            form.addField({
                id: 'custpage_error_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
              .error-container { text-align:center; padding:60px 20px; max-width:700px; margin:0 auto; }
              .error-icon { font-size:60px; color:#d9534f; margin-bottom:20px; }
              .error-title { color:#d9534f; font-size:24px; font-weight:bold; margin-bottom:20px; }
              .error-details { background:#fdf7f7; padding:20px; border-radius:5px; margin:20px 0; border-left:4px solid #d9534f; text-align:left; }
              .btn { padding:12px 24px; background:#d9534f; color:white; border-radius:4px; text-decoration:none; font-weight:bold; display:inline-block; }
            </style>

            <div class="error-container">
              <div class="error-icon">⚠️</div>
              <div class="error-title">Error Processing CSV</div>
              <div class="error-details"><strong>Error Message:</strong><br><pre style="white-space:pre-wrap; word-wrap:break-word; margin-top:10px; color:#333;">${escapeHtml(errorMessage)}</pre></div>
              <p style="color:#666;">Please fix the CSV or input values and try again. Refer to the CSV Template tab for format.</p>
              <div style="margin-top:20px;"><a href="${getScriptURL(context)}" class="btn">Try Again</a></div>
            </div>
        `;

            context.response.writePage(form);
        }

        function processCSV(context) {
            let request = context.request;

            // Get form values
            let vendorId = request.parameters.custpage_vendor;
            let purchaseSerial = request.parameters.custpage_purchase_serial;
            let employeeId = request.parameters.custpage_employee;
            let locationId = request.parameters.custpage_location;
            let delivery = request.parameters.custpage_delivery;
            let vendorCategory = request.parameters.custpage_vendor_category;
            let uploadedFile = request.files ? request.files.custpage_upload_file : null;
            /* let mode = request.parameters.custpage_mode;
            let poToUpdate = request.parameters.custpage_po_id || ''; */

            // Basic validation
            // if (mode === 'create') {
            if (!vendorId) throw new Error('Vendor is required.');
            if (!purchaseSerial) throw new Error('Purchase Serial is required.');
            if (!employeeId) throw new Error('Employee is required.');
            if (!locationId) throw new Error('Location is required.');
            if (!uploadedFile) throw new Error('CSV file is required.');
            if (!delivery) throw new Error('Delivery Path is required.');
            // }

            // if (mode === 'update' && !poToUpdate) throw new Error('Purchase Order selection is required for Update mode.');

            let csvContent = uploadedFile.getContents();
            let lines = parseCSV(csvContent);
            if (lines.length < 2) throw new Error('CSV file has no data.');

            let headers = lines[0].map(h => h.trim().toLowerCase());

            let itemIdx = headers.indexOf('item id');
            let qtyIdx = headers.indexOf('quantity');
            let costIdx = headers.indexOf('cost');
            let discIdx = headers.indexOf('discount');
            let taxCodeIdx = headers.indexOf('tax code');
            // let csvLineIdx = headers.indexOf('line');

            if (itemIdx === -1 || qtyIdx === -1 || costIdx === -1 || taxCodeIdx === -1) {
                throw new Error('CSV must contain Item ID, Quantity, Cost, and Tax Code columns.');
            }
            /* if (mode === 'update' && csvLineIdx === -1) {
                throw new Error('CSV must contain Line column when updating an existing PO.');
            } */

            // Load or create PO
            /* let poRec;
            if (mode === 'update') {
                poRec = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: poToUpdate,
                    isDynamic: true
                });
            } else {
                poRec = record.create({
                    type: record.Type.PURCHASE_ORDER,
                    isDynamic: true
                });
                poRec.setValue({ fieldId: 'entity', value: vendorId });
                poRec.setValue({ fieldId: 'custbody2', value: purchaseSerial });
                poRec.setValue({ fieldId: 'employee', value: employeeId });
                poRec.setValue({ fieldId: 'location', value: locationId });
                poRec.setValue({ fieldId: 'custbody43', value: delivery });
            } */

            let poRec = record.create({
                type: record.Type.PURCHASE_ORDER,
                isDynamic: true
            });
            poRec.setValue({ fieldId: 'entity', value: vendorId });
            poRec.setValue({ fieldId: 'custbody2', value: purchaseSerial });
            poRec.setValue({ fieldId: 'employee', value: employeeId });
            poRec.setValue({ fieldId: 'location', value: locationId });
            poRec.setValue({ fieldId: 'custbody43', value: delivery });

            if (vendorCategory === 4) {
                poRec.setValue({ fieldId: 'customform', value: 108 });
            } else if (vendorCategory === 5) {
                poRec.setValue({ fieldId: 'customform', value: 150 });
            } else if (vendorCategory === 1) {
                poRec.setValue({ fieldId: 'customform', value: 115 });
            } else {
                poRec.setValue({ fieldId: 'customform', value: 98 });
            }

            // Process each row (strict update behavior: Line required for update)
            // let bypassSet = false; // for update-mode use to call setRateChgBypass once

            for (let i = 1; i < lines.length; i++) {
                let cols = lines[i];
                let rowNum = i + 1;

                if (cols.length < headers.length) {
                    throw new Error(`CSV row ${rowNum}: Missing columns, expected ${headers.length} but found ${cols.length}`);
                }

                let itemId = cols[itemIdx].trim();
                let qty = cols[qtyIdx].trim();
                let cost = cols[costIdx].trim();
                let disc = cols[discIdx] ? cols[discIdx].trim() : '';
                let taxCode = cols[taxCodeIdx].trim();
                // let lineValue = (csvLineIdx !== -1) ? (cols[csvLineIdx] ? cols[csvLineIdx].trim() : '') : '';

                if (!itemId || !qty || !cost || !taxCode) {
                    throw new Error(`CSV row ${rowNum}: Missing required values (Item ID, Quantity, Cost, Tax Code).`);
                }

                // additional item checks (re-use your existing validation)
                // Example: vendor category / item status checks (left as original)
                // let vendorCategory = getVendorCategory(vendorId);
                // if (vendorCategory != 5 && getItemInfo(itemId).itemInnerStatus != 'regular') { ... }

                /* if (mode === 'update') {
                    // Strict: Line must be present, numeric, 1-based
                    if (!lineValue) {
                        throw new Error(`CSV row ${rowNum}: Line is required in Update mode.`);
                    }
                    if (!/^[1-9]\d*$/.test(lineValue)) {
                        throw new Error(`CSV row ${rowNum}: Line must be a positive integer (1-based).`);
                    }
                    let idx = parseInt(lineValue, 10) - 1; // convert to 0-based
                    let linecount = poRec.getLineCount({ sublistId: 'item' });
                    if (idx < 0 || idx >= linecount) {
                        throw new Error(`CSV row ${rowNum}: Line ${lineValue} is out of range for PO ${poToUpdate}. PO has ${linecount} lines.`);
                    }
                    poRec.selectLine({ sublistId: 'item', line: idx });
                } else {
                    // create mode: always append new line
                    poRec.selectNewLine({ sublistId: 'item' });
                } */

                // Set sublist values
                poRec.selectNewLine({ sublistId: 'item' });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseFloat(qty) });
                poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: parseFloat(cost) });

                if (disc) {
                    // strip quotes and normalize (already in your code)
                    let parsedDisc = disc.replace(/^"(.*)"$/, '$1').normalize('NFKC').trim();
                    if (!/^\d+(\.\d+)?%$/.test(parsedDisc)) {
                        throw new Error(`CSV row ${rowNum}: Invalid discount format. Use format like 10% or 15.5%`);
                    }

                    // parse percent to numeric (e.g., "10%" => 10)
                    let discountPct = parsePercent(parsedDisc);
                    if (discountPct === null) {
                        throw new Error(`CSV row ${rowNum}: Could not parse discount '${parsedDisc}'`);
                    }

                    // compute amounts/rates BEFORE commit
                    // note: cost and qty are strings; we already set setCurrentSublistValue rate & qty earlier
                    let qtyNum = parseFloat(qty);
                    let rateBefore = parseFloat(cost);

                    // amount before discount (store on line for idempotency)
                    let amountBeforeDisc = +(rateBefore * qtyNum).toFixed(2);

                    // adjusted rate per unit (rounded to 2 decimals)
                    let rateAfter = +(rateBefore * (1 - (discountPct / 100))).toFixed(2);

                    // set the discount field on line (string with % is OK)
                    poRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol6',
                        value: parsedDisc
                    });

                    // set before-discount field (use numeric value, field id from your earlier code)
                    poRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_beforediscount',
                        value: amountBeforeDisc
                    });

                    // set adjusted rate (replace the earlier rate)
                    poRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: rateAfter
                    });

                    // ensure bypass is set once for update mode (poRec.id exists only in update)
                    /* if (!bypassSet && mode === 'update' && poToUpdate) {
                        try {
                            setRateChgBypass(poToUpdate); // assume this is available in your module
                            bypassSet = true;
                        } catch (e) {
                            log.debug({ title: 'setRateChgBypass.error', details: e && e.message ? e.message : e });
                        }
                    } */
                }

                if (taxCode && !isNaN(taxCode)) {
                    poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: parseInt(taxCode, 10) });
                }

                poRec.commitLine({ sublistId: 'item' });
            }

            // Save PO
            let poId = poRec.save();
            showSuccessPage(context, poId);
        }

        function parseCSV(csvText) {
            let rows = [];
            let row = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < csvText.length; i++) {
                let char = csvText[i];
                let nextChar = csvText[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(current.trim());
                    current = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (char === '\r' && nextChar === '\n') i++;
                    row.push(current.trim());
                    rows.push(row);
                    row = [];
                    current = '';
                } else {
                    current += char;
                }
            }

            if (current.length > 0 || row.length > 0) {
                row.push(current.trim());
                rows.push(row);
            }

            return rows.filter(r => r.some(cell => cell !== ''));
        }

        function getItemInfo(itemId) {
            try {
                let res = search.create({
                    type: search.Type.ITEM,
                    filters: [['internalid', search.Operator.IS, itemId]],
                    columns: ['custitem_inner_status', 'csegitem_category']
                }).run().getRange({ start: 0, end: 1 })[0];

                if (!res) return { itemID: itemId, itemInnerStatus: '', itemCategory: null };

                return {
                    itemID: res.id,
                    itemInnerStatus: (res.getValue({ name: 'custitem_inner_status' }) || '').toString().toLowerCase(),
                    itemCategory: res.getValue({ name: 'csegitem_category' })
                };
            } catch (errGetItemInfo) {
                log.debug('errGetItemInfo', errGetItemInfo);
                return { itemID: itemId, itemInnerStatus: '', itemCategory: null };
            }
        }

        function getVendorCategory(vendorId) {
            try {
                let look = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: vendorId,
                    columns: 'category'
                });
                return (look.category && look.category[0]) ? look.category[0].value : null;
            } catch (errGetVendorCategory) {
                log.debug('errGetVendorCategory', errGetVendorCategory);
                return null;
            }
        }

        function getTaxCode() {
            let taxCodeData = [];
            try {
                let results = search.create({
                    type: search.Type.SALES_TAX_ITEM,
                    columns: [
                        search.createColumn({
                            name: 'internalid',
                            sort: search.Sort.ASC
                        }),
                        search.createColumn({
                            name: 'name'
                        })
                    ]
                }).run().getRange({ start: 0, end: 200 });
                for (let i = 0; i < results.length; i++) {
                    taxCodeData.push({ id: results[i].getValue('internalid'), name: results[i].getValue('name') });
                }
            } catch (errGetTaxCode) {
                log.debug('errGetTaxCode', errGetTaxCode);
            }
            return taxCodeData;
        }

        function parsePercent(value) {
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'number') return Math.abs(value);
            var cleaned = String(value).trim().replace('%', '').trim();
            var n = Number(cleaned);
            return Number.isFinite(n) ? Math.abs(n) : null;
        }

        function setRateChgBypass(poId) {
            if (!poId) return;
            try {
                var c = cache.getCache({ name: 'ratechg_bypass', scope: cache.Scope.PRIVATE });
                c.put({ key: 'BYPASS_RATECHG_' + String(poId), value: 'T', ttl: 300 });
                log.debug('setRateChgBypass', 'Set BYPASS_RATECHG_' + String(poId));
            } catch (e) {
                log.debug('setRateChgBypass.error', e);
            }
        }

        function getScriptURL(context) {
            let script = context.request.parameters.script;
            let deploy = context.request.parameters.deploy;
            if (!script || !deploy) {
                // Fallback: return current page
                return '/app/site/hosting/scriptlet.nl';
            }
            return `/app/site/hosting/scriptlet.nl?script=${script}&deploy=${deploy}`;
        }

        function escapeHtml(text) {
            return String(text || '')
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");
        }

        return { onRequest };
    });
