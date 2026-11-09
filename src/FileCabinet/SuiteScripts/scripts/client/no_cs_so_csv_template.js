/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord', 'N/ui/dialog'], function (currentRecord, dialog) {

    const rec = currentRecord.get();

    let validationErrors = [];
    let csvContent = '';
    let isProcessing = false;

    function pageInit(context) {
        // Initialize error display area
        const errorDiv = document.getElementById('csvErrors');
        if (errorDiv) {
            errorDiv.innerHTML = '<div style="color:gray;">No validation errors found</div>';
        }
        return true;
    }

    function fieldChanged(context) {
        if (context.fieldId === 'custpage_upload_file') {
            const fileField = rec.getValue('custpage_upload_file');

            if (!fileField) {
                // Clear preview if file is removed
                const previewDiv = document.getElementById('csvPreview');
                if (previewDiv) previewDiv.innerHTML = '';

                const errorDiv = document.getElementById('csvErrors');
                if (errorDiv) {
                    errorDiv.innerHTML = '<div style="color:gray;">No validation errors found</div>';
                }
                return;
            }
        }
    }

    function validateCSV(csvText) {
        validationErrors = [];
        csvContent = csvText;
        let lines = parseCSV(csvText);

        if (lines.length === 0) {
            validationErrors.push('CSV file is empty');
            return { errors: validationErrors };
        }

        let headers = lines[0].map(h => h.trim().toLowerCase());

        let idx = {
            item: headers.indexOf('item id'),
            qty: headers.indexOf('quantity'),
            cost: headers.indexOf('unit price'),
            prcLvl: headers.indexOf('price level'),
            taxcode: headers.indexOf('tax code')
        };

        // Validate headers
        if (idx.item === -1) validationErrors.push('Missing required header: Item ID');
        if (idx.qty === -1) validationErrors.push('Missing required header: Quantity');
        if (idx.cost === -1) validationErrors.push('Missing required header: Unit Price');
        if (idx.taxcode === -1) validationErrors.push('Missing required header: Tax Code');

        if (validationErrors.length > 0) {
            return { errors: validationErrors };
        }

        // Validate data rows
        for (let i = 1; i < lines.length; i++) {
            let cols = lines[i];
            let lineNum = i + 1;

            // Check for correct number of columns
            if (cols.length < headers.length) {
                validationErrors.push(`Line ${lineNum}: Missing columns, expected ${headers.length} columns but found ${cols.length}`);
                continue;
            }

            // Trim values
            let itemId = cols[idx.item] ? cols[idx.item].trim() : '';
            let quantity = cols[idx.qty] ? cols[idx.qty].trim() : '';
            let cost = cols[idx.cost] ? cols[idx.cost].trim() : '';
            let priceLvl = cols[idx.prcLvl] ? cols[idx.prcLvl].trim() : '';
            let taxCode = cols[idx.taxcode] ? cols[idx.taxcode].trim() : '';

            // Validate each field
            if (!itemId) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Item ID is required`);
            } else if (isNaN(itemId)) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Item ID must be a number (internal ID)`);
            }

            if (!quantity) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Quantity is required`);
            } else if (isNaN(quantity) || Number(quantity) <= 0) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Quantity must be a number greater than 0`);
            }

            if (!cost) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Cost is required`);
            } else if (isNaN(cost) || Number(cost) < 0) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Cost must be a number greater than or equal to 0`);
            }

            if (isNaN(priceLvl)) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Price Level must be a valid number (internal ID)`);
            }

            if (!taxCode) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Tax Code is required`);
            } else if (isNaN(taxCode)) {
                validationErrors.push(`Line ${Number(lineNum - 1)}: Tax Code must be a valid number (internal ID)`);
            }
        }

        return { errors: validationErrors };
    }

    function saveRecord(context) {
        if (isProcessing) {
            dialog.alert({
                title: 'Processing',
                message: 'Please wait while we process your request.'
            });
            return false;
        }

        // Helper: adds/removes error message under field
        function setFieldError(fieldId, message) {

            // Suitelet fields use fieldId_fs
            const fieldWrapper = document.getElementById(fieldId + '_fs');

            if (!fieldWrapper) return;

            // Remove existing error
            let existing = fieldWrapper.parentNode.querySelector('.field-error-msg');
            if (existing) existing.remove();

            if (!message) return; // no error → just remove previous error

            // Create error message element
            const div = document.createElement('div');
            div.className = 'field-error-msg';
            div.style.color = 'red';
            div.style.fontSize = '12px';
            div.style.marginTop = '4px';
            div.textContent = message;

            // Insert AFTER the whole field wrapper row
            fieldWrapper.parentNode.appendChild(div);
        }

        let fieldErrors = [];

        // === REQUIRED INPUT FIELDS ===
        const customer = rec.getValue('custpage_customer');
        const csvFile = rec.getValue('custpage_upload_file');

        function validateField(fieldId, value, label) {
            if (!value) {
                const msg = label + ' is required';
                setFieldError(fieldId, msg);
                fieldErrors.push('• ' + msg);
            } else {
                setFieldError(fieldId, null);
            }
        }

        validateField('custpage_customer', customer, 'Customer');
        validateField('custpage_upload_file', csvFile, 'CSV File');

        // CSV validation
        if (validationErrors && validationErrors.length > 0) {
            const msg = 'CSV contains validation errors';
            setFieldError('custpage_upload_file', msg);
            fieldErrors.push('• ' + msg);
        }

        if (fieldErrors.length > 0) {
            dialog.alert({
                title: 'Validation Errors',
                message: 'Please fix the following:\n\n' + fieldErrors.join('\n')
            });
            return false;
        }

        // Successful validation
        isProcessing = true;
        lockSubmitButton();

        return true;
    }

    function lockSubmitButton() {
        const btn = document.querySelector('input[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.value = 'Processing...';
            btn.style.opacity = "0.6";
            btn.style.cursor = "not-allowed";
        }
    }

    window.parseCSV = function (csvText) {
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

    // Expose validation function for inline HTML
    window.validateCSV = function (csv) {
        let result = validateCSV(csv);

        // Update error display
        const errorDiv = document.getElementById('csvErrors');
        if (errorDiv) {
            if (result.errors.length > 0) {
                errorDiv.innerHTML = '<div style="color:red;font-weight:bold;margin-bottom:5px;">Validation Errors:</div>' +
                    result.errors.map(e => `<div class="csv-error">• ${e}</div>`).join('');
            } else {
                errorDiv.innerHTML = '<div style="color:green;font-weight:bold;">✓ No validation errors found</div>';
            }
        }

        return result;
    };

    window.addEventListener('load', function () {
        const form = document.querySelector('form');
        const overlay = document.getElementById('loadingOverlay');

        if (!form || !overlay) return;

        form.addEventListener('submit', function (e) {

            // saveRecord runs BEFORE submission
            if (typeof saveRecord === 'function') {
                const allowed = saveRecord();

                // ❌ Block submit + hide overlay
                if (!allowed) {
                    e.preventDefault();
                    overlay.style.display = 'none';
                    return false;
                }
            }

            // ✔ Allow submit → show the loading overlay
            overlay.style.display = 'flex';
            return true;
        });
    });

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});