/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord', 'N/ui/dialog', 'N/search'], function (currentRecord, dialog, search) {

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

        // Hide PO selector unless Update selected
        try {
            const mode = rec.getValue('custpage_mode') || 'create';
            const poRow = document.getElementById('custpage_po_id_fs');
            if (poRow) poRow.style.display = (mode === 'update') ? '' : 'none';
        } catch (e) {
            // ignore if DOM not ready
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

        if (context.fieldId === 'custpage_delivery') {
            const deliveryField = rec.getValue('custpage_delivery');
            if (deliveryField == 1) {
                rec.setValue({ fieldId: 'custpage_location', value: 262 });
            } else if (deliveryField == 2) {
                rec.setValue({ fieldId: 'custpage_location', value: 292 });
            } else if (deliveryField == 3) {
                rec.setValue({ fieldId: 'custpage_location', value: 360 });
            } else {
                rec.setValue({ fieldId: 'custpage_location', value: 361 });
            }
        }

        if (context.fieldId === 'custpage_vendor') {
            const vendorField = rec.getValue('custpage_vendor');
            let vendorCategoryId = search.lookupFields({
                type: search.Type.VENDOR,
                id: vendorField,
                columns: ['category']
            }).category[0].value;

            rec.setValue({ fieldId: 'custpage_vendor_category', value: vendorCategoryId });
        }

        if (context.fieldId === 'custpage_mode') {
            const mode = rec.getValue('custpage_mode');

            // Visiability Fields
            const vendorRow = document.getElementById('custpage_vendor_fs');
            const purchaseSerialRow = document.getElementById('custpage_purchase_serial_fs');
            const deliveryPathRow = document.getElementById('custpage_delivery_fs');
            const locationRow = document.getElementById('custpage_location_fs');
            const poRow = document.getElementById('custpage_po_id_fs');

            // Mandatory Fields
            let vendorFld = rec.getField('custpage_vendor');
            let purchaseSerialFld = rec.getField('custpage_purchase_serial');
            let deliveryPathFld = rec.getField('custpage_delivery');
            let locationFld = rec.getField('custpage_location');
            let poFld = rec.getField('custpage_po_id');

            if (poRow) {
                // Visiability
                vendorRow.style.display = (mode === 'update') ? 'none' : '';
                purchaseSerialRow.style.display = (mode === 'update') ? 'none' : '';
                deliveryPathRow.style.display = (mode === 'update') ? 'none' : '';
                locationRow.style.display = (mode === 'update') ? 'none' : '';
                poRow.style.display = (mode === 'update') ? '' : 'none';

                // Mandatory
                vendorFld.isMandatory = (mode === 'update') ? false : true;
                purchaseSerialFld.isMandatory = (mode === 'update') ? false : true;
                deliveryPathFld.isMandatory = (mode === 'update') ? false : true;
                locationFld.isMandatory = (mode === 'update') ? false : true;
                poFld.isMandatory = (mode === 'update') ? true : false;
            }
        }
    }

    function validateCSV(csvText) {
        validationErrors = [];
        csvContent = csvText;
        let lines = parseCSV(csvText);

        if (!lines || lines.length === 0) {
            validationErrors.push('CSV file is empty');
            return { errors: validationErrors };
        }

        let headers = lines[0].map(h => h.trim().toLowerCase());

        let idx = {
            item: headers.indexOf('item id'),
            qty: headers.indexOf('quantity'),
            cost: headers.indexOf('cost'),
            disc: headers.indexOf('discount'),
            taxcode: headers.indexOf('tax code'),
            line: headers.indexOf('line')
        };

        // Validate headers
        if (idx.item === -1) validationErrors.push('Missing required header: Item ID');
        if (idx.qty === -1) validationErrors.push('Missing required header: Quantity');
        if (idx.cost === -1) validationErrors.push('Missing required header: Cost');
        if (idx.taxcode === -1) validationErrors.push('Missing required header: Tax Code');

        // If update mode, require Line header
        const mode = rec.getValue('custpage_mode');
        if (mode === 'update' && idx.line === -1) {
            validationErrors.push('Missing required header: Line (required for Update mode)');
        }

        if (validationErrors.length > 0) {
            return { errors: validationErrors };
        }

        // Validate data rows
        for (let i = 1; i < lines.length; i++) {
            let cols = lines[i];
            let rowNum = i + 1;

            // Check for correct number of columns
            if (cols.length < headers.length) {
                validationErrors.push(`Line ${rowNum}: Missing columns, expected ${headers.length} columns but found ${cols.length}`);
                continue;
            }

            // Trim values
            let itemId = cols[idx.item] ? cols[idx.item].trim() : '';
            let quantity = cols[idx.qty] ? cols[idx.qty].trim() : '';
            let cost = cols[idx.cost] ? cols[idx.cost].trim() : '';
            let discount = (idx.disc !== -1 && cols[idx.disc]) ? cols[idx.disc].trim() : '';
            let taxCode = cols[idx.taxcode] ? cols[idx.taxcode].trim() : '';
            let lineValue = (idx.line !== -1 && cols[idx.line]) ? cols[idx.line].trim() : '';

            // Validate each field
            if (!itemId) {
                validationErrors.push(`Line ${rowNum}: Item ID is required`);
            } else if (isNaN(itemId)) {
                validationErrors.push(`Line ${rowNum}: Item ID must be a number (internal ID)`);
            }

            if (!quantity) {
                validationErrors.push(`Line ${rowNum}: Quantity is required`);
            } else if (isNaN(quantity) || Number(quantity) <= 0) {
                validationErrors.push(`Line ${rowNum}: Quantity must be a number greater than 0`);
            }

            if (!cost) {
                validationErrors.push(`Line ${rowNum}: Cost is required`);
            } else if (isNaN(cost) || Number(cost) < 0) {
                validationErrors.push(`Line ${rowNum}: Cost must be a number greater than or equal to 0`);
            }

            discount = discount.replace(/^"(.*)"$/, '$1').normalize('NFKC').trim();
            if (discount !== '') {
                if (!/^\d+(\.\d+)?%$/.test(discount)) {
                    validationErrors.push(`Line ${rowNum}: Discount must be a percentage (e.g. 10% or 15.5%)`);
                }
            }

            if (!taxCode) {
                validationErrors.push(`Line ${rowNum}: Tax Code is required`);
            } else if (isNaN(taxCode)) {
                validationErrors.push(`Line ${rowNum}: Tax Code must be a valid number (internal ID)`);
            }

            // If update mode, validate Line value is present and 1-based integer
            if (mode === 'update') {
                if (!lineValue) {
                    validationErrors.push(`Line ${rowNum}: Line number is required for Update mode`);
                } else if (!/^[1-9]\d*$/.test(lineValue)) {
                    validationErrors.push(`Line ${rowNum}: Line must be a positive integer (1-based)`);
                }
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

        const vendor = rec.getValue('custpage_vendor');
        const purchaseSerial = rec.getValue('custpage_purchase_serial');
        const employee = rec.getValue('custpage_employee');
        const location = rec.getValue('custpage_location');
        const csvFile = rec.getValue('custpage_upload_file');
        const delivery = rec.getValue('custpage_delivery');
        const mode = rec.getValue('custpage_mode');
        const poId = rec.getValue('custpage_po_id');

        function validateField(fieldId, value, label) {
            if (!value && mode === 'create') {
                const msg = label + ' is required';
                setFieldError(fieldId, msg);
                fieldErrors.push('• ' + msg);
            } else {
                setFieldError(fieldId, null);
            }
        }

        validateField('custpage_vendor', vendor, 'Vendor');
        validateField('custpage_purchase_serial', purchaseSerial, 'Purchase Serial');
        validateField('custpage_employee', employee, 'Employee');
        validateField('custpage_location', location, 'Location');
        validateField('custpage_upload_file', csvFile, 'CSV File');
        validateField('custpage_delivery', delivery, 'Delivery Path');

        if (mode === 'update') {
            if (!poId) {
                setFieldError('custpage_po_id', 'Purchase Order is required when Action = Update');
                fieldErrors.push('• Purchase Order is required when Action = Update');
            } else {
                setFieldError('custpage_po_id', null);
            }
        }

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
