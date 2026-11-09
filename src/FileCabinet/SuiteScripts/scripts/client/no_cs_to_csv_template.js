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
                const previewDiv = document.getElementById('csvPreview');
                if (previewDiv) previewDiv.innerHTML = '';
                const errorDiv = document.getElementById('csvErrors');
                if (errorDiv) errorDiv.innerHTML = '<div style="color:gray;">No validation errors found</div>';
                validationErrors = [];
                csvContent = '';
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
            item: headers.indexOf('item'),
            qty: headers.indexOf('quantity')
        };

        // Validate headers
        if (idx.item === -1) validationErrors.push('Missing required header: Item ID');
        if (idx.qty === -1) validationErrors.push('Missing required header: Quantity');

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
        }

        return { errors: validationErrors };
    }

    function saveRecord(context) {
        if (isProcessing) {
            dialog.alert({ title: 'Processing', message: 'Please wait while we process your request.' });
            return false;
        }

        function setFieldError(fieldId, message) {
            const fieldWrapper = document.getElementById(fieldId + '_fs');
            if (!fieldWrapper) return;
            let existing = fieldWrapper.parentNode.querySelector('.field-error-msg');
            if (existing) existing.remove();
            if (!message) return;
            const div = document.createElement('div');
            div.className = 'field-error-msg';
            div.style.color = 'red';
            div.style.fontSize = '12px';
            div.style.marginTop = '4px';
            div.textContent = message;
            fieldWrapper.parentNode.appendChild(div);
        }

        let fieldErrors = [];

        const subsidiary = rec.getValue('custpage_subsidiary');
        const incoterm = rec.getValue('custpage_incoterm');
        const location = rec.getValue('custpage_location');
        const toLocation = rec.getValue('custpage_tolocation');
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

        validateField('custpage_subsidiary', subsidiary, 'Subsidiary');
        validateField('custpage_incoterm', incoterm, 'Incoterm');
        validateField('custpage_location', location, 'Location');
        validateField('custpage_tolocation', toLocation, 'To Location');
        validateField('custpage_upload_file', csvFile, 'CSV File');

        // If user already validated CSV via preview, validationErrors contains last result
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

        // Passed validation
        isProcessing = true;
        lockSubmitButton();

        return true;
    }

    function lockSubmitButton() {
        const btn = document.querySelector('input[type="submit"], input[type="button"].uir-button');
        if (btn) {
            btn.disabled = true;
            try { btn.value = 'Processing...'; } catch (e) { }
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
    };

    // Expose validation function
    window.validateCSV = function (csv) {
        let result = validateCSV(csv);

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

        if (!form) return;

        form.addEventListener('submit', function (e) {
            if (typeof saveRecord === 'function') {
                const allowed = saveRecord();
                if (!allowed) {
                    e.preventDefault();
                    if (overlay) overlay.style.display = 'none';
                    return false;
                }
            }
            if (overlay) overlay.style.display = 'flex';
            return true;
        });
    });

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});