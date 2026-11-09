/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/email', 'N/format', 'N/runtime'], function (record, search, email, format, runtime) {

    function afterSubmit(context) {
        try {
            let objNewRecord = context.newRecord;

            let poId = objNewRecord.getValue('createdfrom');

            let objLoadPoRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId
            });

            let poStatus = objLoadPoRecord.getValue('status');

            if (poStatus !== 'Pending Billing/Partially Received') return;

            let objItemQty = {};
            let itemReceiptCount = objNewRecord.getLineCount('item');
            for (let i = 0; i < itemReceiptCount; i++) {
                let irItemId = objNewRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                let irQty = objNewRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });

                if (!objItemQty[irItemId]) {
                    objItemQty[irItemId] = irQty;
                } else {
                    objItemQty[irItemId] += irQty;
                }
            }

            let remainingItems = [];
            let sumOrderedQty = 0;
            let sumDeliveredQty = 0;
            let poCount = objLoadPoRecord.getLineCount('item');
            for (let j = 0; j < poCount; j++) {
                let poItemId = objLoadPoRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: j
                });

                let intNiceOneId = objLoadPoRecord.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: j
                });

                let intBarcode = objLoadPoRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_no_barcode',
                    line: j
                });

                let strEnglishDescription = objLoadPoRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_no_disp_nam_lin',
                    line: j
                });

                let productImage = search.lookupFields({
                    type: search.Type.ITEM,
                    id: poItemId,
                    columns: 'custitem24'
                }).custitem24;

                let poQty = objLoadPoRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: j
                });

                let fltUnitPrice = objLoadPoRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: j
                });

                let irQty = objItemQty[poItemId] || 0;

                // 1. Item not received
                if (irQty === 0) {
                    remainingItems.push({
                        item: poItemId,
                        poQty: poQty,
                        receivedQty: 0,
                        intNiceOneId: intNiceOneId,
                        intBarcode: intBarcode,
                        strEnglishDescription: strEnglishDescription,
                        productImage: productImage,
                        fltUnitPrice: fltUnitPrice,
                        status: 'Not Received'
                    });
                }

                // 2. Item partially received
                else if (irQty < poQty) {
                    remainingItems.push({
                        item: poItemId,
                        poQty: poQty,
                        receivedQty: irQty,
                        intNiceOneId: intNiceOneId,
                        intBarcode: intBarcode,
                        strEnglishDescription: strEnglishDescription,
                        productImage: productImage,
                        fltUnitPrice: fltUnitPrice,
                        status: 'Partially Received'
                    });
                }

                sumOrderedQty += poQty;
                sumDeliveredQty += irQty;
            }

            if (remainingItems.length === 0) return;

            let vendorId = objLoadPoRecord.getValue('entity');
            if (!vendorId) return;

            let vendorEmail = search.lookupFields({
                type: search.Type.VENDOR,
                id: vendorId,
                columns: ['email']
            }).email;

            if (!vendorEmail) return;

            let strPoNumber = objLoadPoRecord.getValue('tranid');
            let strPoDate = objLoadPoRecord.getValue('trandate');
            strPoDate = format.format({
                value: new Date(strPoDate),
                type: format.Type.DATE
            });

            let vendorVat = objLoadPoRecord.getValue('vatregnum');
            let vendorNumber = objLoadPoRecord.getText('entity').match(/^\d+/)?.[0] || '';
            let strVendorName = objLoadPoRecord.getText('entity').replace(/^\d+\s*/, '');

            let objEmailBody = `
                <!doctype html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
                </head>
                <body style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; margin:0; padding:0; background:#f6f6f6; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="background:#f6f6f6; width:100%; border-collapse:collapse; margin:0; padding:0;">
                        <tr>
                            <td align="center" style="padding:20px;">
                                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:800px; width:100%; background:#ffffff; border:1px solid #e6e6e6; border-radius:6px; overflow:hidden;">

                                    <!-- Header -->
                                    <tr>
                                        <td style="padding:20px 24px; border-bottom:1px solid #ececec;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="vertical-align:top;">
                                                        <h2 style="margin:0; font-size:18px;">Purchase Order</h2>
                                                        <div style="margin-top:6px; color:#444;">
                                                            <strong>PO:</strong> ${strPoNumber || ''} &nbsp; | &nbsp;
                                                            <strong>Date:</strong> ${strPoDate || ''}
                                                        </div>
                                                    </td>
                                                    <td style="text-align:right; vertical-align:top;">
                                                        <div style="text-align:right;">
                                                            <div style="font-weight:600;">Nice One Beauty Digital Marketing Company</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Vendor Summary -->
                                    <tr>
                                        <td style="padding:16px 24px; border-bottom:1px solid #f0f0f0; background:#fafafa;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#333;">
                                                <tr>
                                                    <td style="vertical-align:top; ">
                                                        <div style="font-weight:600; margin-bottom:8px;">Vendor Details</div>
                                                        <div><b>Supplier:</b> ${strVendorName || ''}</div>
                                                        <div><b>Supplier No:</b> ${vendorNumber || ''}</div>
                                                        <div><b>VAT Reg No:</b> ${vendorVat || ''}</div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Items Summary -->
                                    <tr>
                                        <td style="padding:18px 24px; border-top:1px solid #ececec; background:#fcfcfc;">
                                            <div style="font-size:12px; color:#666; line-height:1.45;">
                                                <div style="margin-top:6px;">
                                                    The Following items were not received as ordered, Please reply with the reasons:
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    <tr>
                                        <td style="padding:18px 24px; border-top:1px solid #ececec; background:#fcfcfc;">
                                            <div style="font-size:12px; color:#666; line-height:1.45;">
                                                <div style="margin-top:6px;">
                                                    Service level: ${parseInt((sumDeliveredQty / sumOrderedQty) * 100)}%
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Items table -->
                                    <tr>
                                        <td style="padding:16px 12px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; color:#222;">
                                                <thead>
                                                    <tr style="background:#707070; color:#ffffff;">
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Product ID</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Product Image</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:left;">Product Name</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Barcode</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Quantity</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:right;">Received Quantity</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:right;">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${remainingItems.map((item, idx) => `
                                                        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fbfbfb'};">
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.intNiceOneId || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">
                                                                ${item.productImage ? `<img src="${item.productImage}" style="max-width:100px; max-height:90px; object-fit:contain;" />` : ''}
                                                            </td>
                                                            <td style="padding:8px; border:1px solid #eee;">${item.strEnglishDescription || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.intBarcode || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.poQty || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:right;">${item.receivedQty}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:right;">${item.status || ''}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                `;


            email.send({
                author: runtime.getCurrentUser().id,
                body: objEmailBody,
                recipients: vendorEmail,
                cc: [runtime.getCurrentUser().id, -5, 3096841, 7009237],
                subject: `Check PO #${strPoNumber}`
            });
        } catch (errAfterSubmit) {
            log.debug('errAfterSubmit', errAfterSubmit);
        }
    }

    return {
        afterSubmit: afterSubmit
    }
});
