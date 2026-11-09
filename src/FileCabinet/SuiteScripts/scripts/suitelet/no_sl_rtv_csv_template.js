/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/runtime'],
    function (serverWidget, record, search, runtime) {

        function onRequest(context) {
            try {
                if (context.request.method === 'GET') {
                    // Check if this is a redirect back from successful creation
                    if (context.request.parameters.success === 'true' && context.request.parameters.poid) {
                        showSuccessPage(context, context.request.parameters.poid);
                    } else {
                        buildForm(context);
                    }
                } else {
                    processCSV(context);
                }
            } catch (e) {
                showErrorPage(context, e.message);
            }
        }

        function buildForm(context) {
            let form = serverWidget.createForm({
                title: 'Upload RTV CSV'
            });

            form.clientScriptModulePath = '../client/no_cs_rtv_csv_template.js'; // SB: ../client/no_cs_so_csv_template.js - PROD: SuiteScripts/no_cs_so_csv_template.js
            // ============================================
            // SECTION 1: INPUT FIELDS (All together)
            // ============================================
            form.addFieldGroup({
                id: 'custpage_input_section',
                label: 'Return Authorization Details'
            });

            // Create a table-like layout using inline HTML for the fields
            form.addField({
                id: 'custpage_fields_header',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
                .fields-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    margin-bottom: 25px;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 5px;
                    border: 1px solid #e0e0e0;
                }
                .field-item {
                    flex: 1;
                    min-width: 200px;
                }
                .field-item label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }
                .required-field::after {
                    content: " *";
                    color: red;
                }
                @media (max-width: 768px) {
                    .fields-container {
                        flex-direction: column;
                    }
                }
            </style>
        `;

            // Upload CSV File Field
            let uploadFld = form.addField({
                id: 'custpage_upload_file',
                label: 'Upload CSV File',
                type: serverWidget.FieldType.FILE,
                // container: 'custpage_input_section'
            });
            uploadFld.isMandatory = true;
            uploadFld.helpText = 'Select the CSV file containing Return Auth. line items';

            // Vendor Field
            let customerFld = form.addField({
                id: 'custpage_customer',
                label: 'Vendor',
                type: serverWidget.FieldType.SELECT,
                source: 'vendor',
                container: 'custpage_input_section'
            });
            customerFld.isMandatory = true;
            customerFld.helpText = 'Select the Customer for this return auth.';

            // Add inline HTML to group the fields visually
            form.addField({
                id: 'custpage_fields_wrapper',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <script>
                // Move fields into the styled containers
                window.addEventListener('DOMContentLoaded', function() {
                    // Get field containers
                    const uploadField = document.querySelector('[data-fieldid="custpage_upload_file"]');
                    const customerField = document.querySelector('[data-fieldid="custpage_customer"]');
                    
                    // Move fields into styled containers
                    if (uploadField && uploadField.parentNode) {
                        document.getElementById('upload-file-container').appendChild(uploadField);
                    }
                    if (customerField && customerField.parentNode) {
                        document.getElementById('customer-container').appendChild(customerField);
                    }
                    
                    // Remove original labels (since we're using custom ones)
                    const labels = document.querySelectorAll('label[for*="custpage_"]');
                    labels.forEach(label => {
                        if (label.textContent.includes('Upload CSV File') || 
                            label.textContent.includes('Customer')) {
                            label.style.display = 'none';
                        }
                    });
                });
            </script>
        `;

            // ============================================
            // SECTION 2: CSV PREVIEW
            // ============================================
            var taxCodes = getTaxCode();
            var locations = getLocations();

            form.addField({
                id: 'custpage_preview_section',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'CSV Preview'
            }).defaultValue = `
             <style>
              .preview-row { display:flex; gap:20px; margin-top:20px; }
              .preview-container { padding:20px; background:#fff; border-radius:5px; border:1px solid #e0e0e0; }
              .tax-container { width:100%; height:420px; display:flex; flex-direction:column; }
              .location-container { width:100%; height:420px; display:flex; flex-direction:column; }
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
            <!-- Location preview -->
                <div class="preview-container location-container">
                <div class="preview-header">
                  <div class="preview-title">Location</div>
                </div>
                <input type="text" id="locationSearch" class="search-box" placeholder="Search location...">
                <div class="table-scroll">
                  <table class="csv-preview-table" id="locationTable">
                    <thead><tr><th>ID</th><th>Location</th></tr></thead>
                    <tbody><tr><td colspan="2" class="no-file">Loading...</td></tr></tbody>
                  </table>
                </div>
              </div>

            
            <!-- Tax code preview -->
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
                // Locations
                window.locationData = ${JSON.stringify(locations)};

                function renderLocations(filter) {
                  var tbody = document.querySelector('#locationTable tbody');
                  if (!window.locationData || window.locationData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="2" class="no-file">No Data</td></tr>';
                    return;
                  }
                  var html = '';
                  var keyword = (filter || '').toLowerCase();
                  for (var i = 0; i < window.locationData.length; i++) {
                    var item = window.locationData[i];
                    if (keyword && item.name.toLowerCase().indexOf(keyword) === -1 && item.id.toString().indexOf(keyword) === -1) {
                      continue;
                    }
                    html += '<tr><td>' + item.id + '</td><td>' + item.name + '</td></tr>';
                  }
                  if (!html) html = '<tr><td colspan="2" class="no-file">No results</td></tr>';
                  tbody.innerHTML = html;
                }

                renderLocations();

                let locationTimeout;
                document.getElementById('locationSearch').addEventListener('input', function () {
                  clearTimeout(locationTimeout);
                  const value = this.value;
                  locationTimeout = setTimeout(function () { renderLocations(value); }, 200);
                });


                // Tax Codes
                /* window.taxCodesData = ${JSON.stringify(taxCodes)};

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

                let taxCodesTimeout;
                document.getElementById('taxSearch').addEventListener('input', function () {
                  clearTimeout(taxCodesTimeout);
                  const value = this.value;
                  taxCodesTimeout = setTimeout(function () { renderTaxCodes(value); }, 200);
                }); */

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

            // ============================================
            // SECTION 3: TEMPLATE TAB
            // ============================================
            form.addTab({
                id: 'custpage_template_tab',
                label: 'CSV Template'
            });

            let csvTemplateHTML = `
            <style>
                .template-container {
                    padding: 20px;
                }
                .template-title {
                    color: #4a6fa5;
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #4a6fa5;
                }
                .template-instructions {
                    background-color: #e8f4fd;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                    border-left: 4px solid #4a6fa5;
                }
                .csv-template-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                }
                .csv-template-table th {
                    background-color: #4a6fa5;
                    color: #fff;
                    padding: 12px;
                    border: 1px solid #ddd;
                    text-align: left;
                }
                .csv-template-table td {
                    padding: 12px;
                    border: 1px solid #ddd;
                }
                .csv-template-table tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
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
                .example-section {
                    margin-top: 30px;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 5px;
                }
                .example-title {
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 15px;
                }
                .example-code {
                    background-color: #f5f5f5;
                    padding: 15px;
                    border-radius: 3px;
                    border-left: 4px solid #4a6fa5;
                    font-family: monospace;
                    white-space: pre-wrap;
                    overflow-x: auto;
                }
                .download-section {
                    margin-top: 30px;
                    text-align: center;
                }
                .download-btn {
                    display: inline-block;
                    background-color: #5cb85c;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .download-btn:hover {
                    background-color: #4cae4c;
                }
            </style>

            <div class="template-container">
                <div class="template-title">CSV Template Instructions</div>
                
                <div class="template-instructions">
                    <p><strong>Important:</strong> Your CSV file must follow this exact format. The column headers must match exactly as shown below.</p>
                    <p>Download the template file to ensure proper formatting.</p>
                </div>

                <table class="csv-template-table">
                    <thead>
                        <tr>
                            <th>Column Header</th>
                            <th>Description</th>
                            <th>Data Type</th>
                            <th>Required</th>
                            <th>Example</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Item ID</strong></td>
                            <td>The internal ID of the inventory item</td>
                            <td>Number</td>
                            <td><span class="required-badge">REQUIRED</span></td>
                            <td>12345</td>
                        </tr>
                        <tr>
                            <td><strong>Quantity</strong></td>
                            <td>Number of units to sales</td>
                            <td>Number</td>
                            <td><span class="required-badge">REQUIRED</span></td>
                            <td>10</td>
                        </tr>
                        <tr>
                            <td><strong>Unit Price</strong></td>
                            <td>Unit price per item</td>
                            <td>Number (Decimal)</td>
                            <td><span class="required-badge">REQUIRED</span></td>
                            <td>25.99</td>
                        </tr>
                        <tr>
                            <td><strong>Tax Code</strong></td>
                            <td>Internal ID of the tax code</td>
                            <td>Number</td>
                            <td><span class="required-badge">REQUIRED</span></td>
                            <td>1</td>
                        </tr>
                        <tr>
                            <td><strong>Location</strong></td>
                            <td>Internal ID of the location</td>
                            <td>Number</td>
                            <td><span class="required-badge">REQUIRED</span></td>
                            <td>1</td>
                        </tr>
                    </tbody>
                </table>

                <div class="example-section">
                    <div class="example-title">Example CSV Content:</div>
                    <div class="example-code">
Item ID,Quantity,Unit Price,Tax Code,Location
12345,10,25.99,-1,1
12346,5,15.50,,2
12347,20,8.75,1,1
                    </div>
                    <p style="margin-top: 10px; color: #666;">
                        <strong>Note:</strong> Leave cells empty for optional fields (like Price Level in the second row).
                    </p>
                </div>

                <div class="download-section">
                    <a href="#" id="downloadTemplate" class="download-btn">Download CSV Template</a>
                </div>
            </div>

            <script>
                // Download template functionality
                document.getElementById('downloadTemplate').addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    const templateContent = "Item ID,Quantity,Unit Price,Location\\n" +
                                          "12345,10,25.99,1,1\\n" +
                                          "12346,5,15.50,2,1\\n" +
                                          "12347,20,8.75,1,1";
                    
                    const blob = new Blob([templateContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'RTV_Template.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
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

            // ============================================
            // SUBMIT BUTTON
            // ============================================
            form.addSubmitButton({
                label: 'Create',
                id: 'custpage_submit_button'
            });

            context.response.writePage(form);
        }

        function showSuccessPage(context, poId) {
            let form = serverWidget.createForm({
                title: 'Return Authorization Created Successfully!'
            });

            form.addField({
                id: 'custpage_success_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
                .success-container {
                    text-align: center;
                    padding: 60px 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .success-icon {
                    font-size: 60px;
                    color: #5cb85c;
                    margin-bottom: 20px;
                }
                .success-title {
                    color: #5cb85c;
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .po-id {
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                    border-left: 4px solid #5cb85c;
                    font-size: 18px;
                }
                .button-group {
                    margin-top: 30px;
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                .btn {
                    padding: 12px 24px;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: bold;
                    display: inline-block;
                    min-width: 180px;
                    text-align: center;
                }
                .btn-primary {
                    background-color: #4a6fa5;
                    color: white;
                }
                .btn-primary:hover {
                    background-color: #3a5a85;
                }
                .btn-secondary {
                    background-color: #6c757d;
                    color: white;
                }
                .btn-secondary:hover {
                    background-color: #5a6268;
                }
                .auto-redirect {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #999;
                    font-size: 14px;
                }
            </style>

            <div class="success-container">
                <div class="success-icon">✅</div>
                <div class="success-title">Return Authorization Created Successfully!</div>
                
                <div class="po-id">
                    <strong>RTV Internal ID:</strong> ${poId}
                </div>
                
                <p style="color: #666; margin-bottom: 30px;">
                    Your return authorization has been created successfully. You can now view or edit it in NetSuite.
                </p>
                
                <div class="button-group">
                    <a href="/app/accounting/transactions/vendauth.nl?id=${poId}" 
                       target="_blank" 
                       class="btn btn-primary">
                        View Return Authorization
                    </a>
                    <a href="${getScriptURL(context)}" 
                       class="btn btn-secondary">
                        Create Another RTV
                    </a>
                </div>
                
                <div class="auto-redirect">
                    This page will automatically redirect to create another RTV in <span id="countdown">10</span> seconds...
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
            let form = serverWidget.createForm({
                title: 'Error Creating Return Authorization'
            });

            form.addField({
                id: 'custpage_error_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = `
            <style>
                .error-container {
                    text-align: center;
                    padding: 60px 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .error-icon {
                    font-size: 60px;
                    color: #d9534f;
                    margin-bottom: 20px;
                }
                .error-title {
                    color: #d9534f;
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .error-details {
                    background-color: #fdf7f7;
                    padding: 20px;
                    border-radius: 5px;
                    margin: 20px 0;
                    border-left: 4px solid #d9534f;
                    text-align: left;
                }
                .button-group {
                    margin-top: 30px;
                }
                .btn {
                    padding: 12px 24px;
                    background-color: #d9534f;
                    color: white;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: bold;
                    display: inline-block;
                }
                .btn:hover {
                    background-color: #c9302c;
                }
            </style>

            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Error Processing CSV</div>
                
                <div class="error-details">
                    <strong>Error Message:</strong><br>
                    <pre style="white-space: pre-wrap; word-wrap: break-word; margin-top: 10px; color: #333;">${escapeHtml(errorMessage)}</pre>
                </div>
                
                <p style="color: #666; margin-bottom: 30px;">
                    Please check your CSV file format and try again. You can download the template from the CSV Template tab.
                </p>
                
                <div class="button-group">
                    <a href="${getScriptURL(context)}" 
                       class="btn">
                        Try Again
                    </a>
                </div>
            </div>
            
            <script>
                // Hide loading overlay if it's still showing
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            </script>
        `;

            context.response.writePage(form);
        }

        function processCSV(context) {
            let request = context.request;

            // Get form values
            let customerId = request.parameters.custpage_customer;
            let uploadedFile = request.files.custpage_upload_file;

            // Basic validation (should have already been done client-side)
            if (!customerId) throw new Error('Customer is required.');
            if (!uploadedFile) throw new Error('CSV file is required.');

            let csvContent = uploadedFile.getContents();
            let lines = parseCSV(csvContent);

            if (lines.length < 2) {
                throw new Error('CSV file has no data.');
            }

            let headers = lines[0].map(h => h.trim().toLowerCase());

            let itemIdx = headers.indexOf('item id');
            let qtyIdx = headers.indexOf('quantity');
            let costIdx = headers.indexOf('unit price');
            let taxCodeIdx = headers.indexOf('tax code');
            let locationIdx = headers.indexOf('location');

            if (itemIdx === -1 || qtyIdx === -1 || costIdx === -1 || taxCodeIdx === -1 || locationIdx === -1) {
                throw new Error('CSV must contain Item ID, Quantity, Unit Price, Tax Code, and Location columns.');
            }

            // Create RTV
            let rtvRec = record.create({
                type: record.Type.VENDOR_RETURN_AUTHORIZATION,
                isDynamic: true
            });

            rtvRec.setValue({
                fieldId: 'entity',
                value: customerId
            });

            // Process lines
            for (let i = 1; i < lines.length; i++) {
                let cols = lines[i];

                // Ensure we have enough columns
                if (cols.length < headers.length) {
                    throw new Error(`Line ${i}: Missing columns, expected ${headers.length} but found ${cols.length}`);
                }

                // log.debug('getItemInfo[' + i + ']', getItemInfo(cols[itemIdx].trim()));

                // let itemId = getItemInfo(cols[itemIdx].trim()).itemID;
                let itemId = cols[itemIdx].trim();
                let qty = cols[qtyIdx].trim();
                let cost = cols[costIdx].trim();
                let taxCode = cols[taxCodeIdx].trim();
                let location = cols[locationIdx].trim();

                if (!itemId || !qty || !cost || !taxCode || !location) {
                    throw new Error(`Missing required values at line ${i}`);
                }

                rtvRec.selectNewLine({ sublistId: 'item' });

                rtvRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemId
                });

                rtvRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: parseFloat(qty)
                });

                rtvRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: parseFloat(cost)
                });

                // Tax code
                if (taxCode && !isNaN(taxCode)) {
                    rtvRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: parseInt(taxCode)
                    });
                }

                rtvRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: location
                });

                rtvRec.commitLine({ sublistId: 'item' });
            }

            let rtvId = rtvRec.save();

            // Show success page
            showSuccessPage(context, rtvId);
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
                        // Escaped quote ""
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                }
                else if (char === ',' && !inQuotes) {
                    row.push(current.trim());
                    current = '';
                }
                else if ((char === '\n' || char === '\r') && !inQuotes) {

                    if (char === '\r' && nextChar === '\n') {
                        i++; // Skip Windows \r\n
                    }

                    row.push(current.trim());
                    rows.push(row);
                    row = [];
                    current = '';
                }
                else {
                    current += char;
                }
            }

            // Push last field
            if (current.length > 0 || row.length > 0) {
                row.push(current.trim());
                rows.push(row);
            }

            // Remove empty rows
            return rows.filter(r => r.some(cell => cell !== ''));
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

        function getLocations() {
            let locationData = [];
            try {
                let results = search.create({
                    type: search.Type.LOCATION,
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
                    locationData.push({ id: results[i].getValue('internalid'), name: results[i].getValue('name') });
                }
            } catch (errGetLocations) {
                log.debug('errGetLocations', errGetLocations);
            }
            return locationData;
        }

        function getScriptURL(context) {
            // Helper to get the script URL for links
            let script = context.request.parameters.script;
            let deployment = context.request.parameters.deploy;
            return `/app/site/hosting/scriptlet.nl?script=${script}&deploy=${deployment}`;
        }

        function escapeHtml(text) {
            // Simple HTML escaping
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");
        }

        return { onRequest };
    });