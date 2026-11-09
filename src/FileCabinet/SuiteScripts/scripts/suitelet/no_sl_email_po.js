/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/runtime', 'N/email', 'N/render', 'N/record', 'N/search', 'N/format'], function (runtime, email, render, record, search, format) {

    function onRequest(context) {
        let objServerRequest = context.request;
        let response = {
            success: false,
            message: ''
        };

        let objParams = objServerRequest.parameters;

        try {
            let intRecordId = objParams.recordId;
            let strRecordType = objParams.recordType;

            if (objServerRequest.method == 'GET') {
                let objLoadRecord = record.load({
                    type: strRecordType,
                    id: intRecordId
                });

                let intCustomFormId = objLoadRecord.getValue('customform');

                let strVendorEmail = search.lookupFields({
                    type: search.Type.ENTITY,
                    id: objLoadRecord.getValue('entity'),
                    columns: 'email'
                }).email;

                let vendorVat = objLoadRecord.getValue('vatregnum');

                let vendorNumber = objLoadRecord.getText('entity').match(/^\d+/)?.[0] || '';
                let strVendorName = objLoadRecord.getText('entity').replace(/^\d+\s*/, '');
                let strLocation = objLoadRecord.getText('location');

                let strPoNumber = objLoadRecord.getValue('tranid');
                let strPoDate = objLoadRecord.getValue('trandate');
                strPoDate = format.format({
                    value: new Date(strPoDate),
                    type: format.Type.DATE
                });

                let shippingRequestedBy = objLoadRecord.getText('employee').replace(/^\d+\s*/, '');
                let shippingAddress = objLoadRecord.getValue('shipto');

                let strEmployeeEmail;
                if (objLoadRecord.getValue('employee')) {
                    strEmployeeEmail = search.lookupFields({
                        type: search.Type.ENTITY,
                        id: objLoadRecord.getValue('employee'),
                        columns: 'email'
                    }).email;
                }

                let strCurrency = objLoadRecord.getText('currency');

                let arrItems = [];
                let intLineCount = objLoadRecord.getLineCount('item');
                for (let i = 0; i < intLineCount; i++) {
                    let intItemId = objLoadRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    let intNiceOneId = objLoadRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    let intBarcode = objLoadRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_no_barcode',
                        line: i
                    });

                    let strEnglishDescription = objLoadRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_no_disp_nam_lin',
                        line: i
                    });

                    let productImage = search.lookupFields({
                        type: search.Type.ITEM,
                        id: intItemId,
                        columns: 'custitem24'
                    }).custitem24;

                    let intQty = objLoadRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    let fltUnitPrice = objLoadRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        line: i
                    });

                    arrItems.push({
                        intNiceOneId: intNiceOneId,
                        intBarcode: intBarcode,
                        strEnglishDescription: strEnglishDescription,
                        productImage: productImage,
                        intQty: intQty,
                        fltUnitPrice: fltUnitPrice
                    });
                }

                let totalExclVat = objLoadRecord.getValue('subtotal');
                let totalInclVat = objLoadRecord.getValue('total');

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
                                                        <h2 style="margin:0; font-size:18px; color:#0a4d8c;">Purchase Order</h2>
                                                        <div style="margin-top:6px; color:#444;">
                                                            <strong>PO:</strong> ${strPoNumber || ''} &nbsp; | &nbsp;
                                                            <strong>Date:</strong> ${strPoDate || ''}
                                                        </div>
                                                    </td>
                                                    <td style="text-align:right; vertical-align:top;">
                                                        <div style="text-align:right;">
                                                            <div style="font-weight:600; color:#0a4d8c;">Nice One Beauty Digital Marketing Company</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Vendor & Shipping & PO Summary -->
                                    <tr>
                                        <td style="padding:16px 24px; border-bottom:1px solid #f0f0f0; background:#fafafa;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#333;">
                                                <tr>
                                                    <td style="vertical-align:top; ">
                                                        <div style="font-weight:600; margin-bottom:8px;">Vendor Details</div>
                                                        <div>Supplier: ${strVendorName || ''}</div>
                                                        <div>Supplier No: ${vendorNumber || ''}</div>
                                                        <div>VAT Reg No: ${vendorVat || ''}</div>
                                                    </td>
                                                    <td style="vertical-align:top;">
                                                        <div style="font-weight:600; margin-bottom:8px;">Shipping Information</div>
                                                        <div>Order requested by: ${shippingRequestedBy || ''}</div>
                                                        <div>Address: ${shippingAddress || ''}</div>
                                                    </td>
                                                    <td style="vertical-align:top;">
                                                        <div style="font-weight:600; margin-bottom:8px;">PO Summary</div>
                                                        <div>Number Of Items: ${intLineCount || 0}</div>
                                                        <div style="font-size:12px;">Total Excluding VAT: ${totalExclVat || '0.00'} ${strCurrency || ''}</div>
                                                        <div style="font-size:12px;">Total Including VAT: ${totalInclVat || '0.00'} ${strCurrency || ''}</div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Arabic instruction block -->
                                    <tr>
                                        <td style="padding:14px 24px; border-bottom:1px solid #f0f0f0;">
                                            <div dir="rtl" lang="ar" style="font-size:13px; color:#333; line-height:1.45;">
                                                <strong>يرجى مراجعة سعر التكلفة المذكور في أمر الشراء، وإشعارنا بأي اختلاف قبل اصدار الفاتورة</strong>
                                                <div style="margin-top:8px;">
                                                    نرجو إرسال نسخة من الفاتورة <span>(m.alaziz@niceonesa.com${strEmployeeEmail ? ' &amp; ' + strEmployeeEmail : ''})</span> قبل تاريخ ووقت التسليم إلى البريد التالي: تأكيد موعد الاستلام
                                                </div>
                                                <div style="margin-top:8px;">
                                                    يرجى عدم تسليم أي أصناف غير مطلوبة أو كميات تزيد عن المذكورة في أمر الشراء حيث سيتم رفضها وفي حال التوريد الجزئي للطلب، سيتم إغلاق أمر الشراء في نظامنا وفقاً لذلك.
                                                </div>
                                                <div style="margin-top:8px;">
                                                    سيتم حذف الطلب تلقائياً من نظامنا بعد مرور 6 أيام في حال عدم توريده بالموعد المتفق عليه.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Items table -->
                                    <tr>
                                        <td style="padding:16px 12px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; color:#222;">
                                                <thead>
                                                    <tr style="background:#0a4d8c; color:#ffffff;">
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Product ID</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Product Image</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:left;">Product Name</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Barcode</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:center;">Quantity</th>
                                                        <th style="padding:5px; border:1px solid #e6e6e6; text-align:right;">Unit Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${arrItems.map((item, idx) => `
                                                        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fbfbfb'};">
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.intNiceOneId || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">
                                                                ${item.productImage ? `<img src="${item.productImage}" style="max-width:100px; max-height:90px; object-fit:contain;" />` : ''}
                                                            </td>
                                                            <td style="padding:8px; border:1px solid #eee;">${item.strEnglishDescription || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.intBarcode || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:center;">${item.intQty || ''}</td>
                                                            <td style="padding:8px; border:1px solid #eee; text-align:right;">${item.fltUnitPrice || ''}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colspan="4" style="padding:10px; border:1px solid #eee; background:#fafafa;">&nbsp;</td>
                                                        <td style="padding:10px; border:1px solid #eee; text-align:center; background:#fafafa; font-weight:600;">Total</td>
                                                        <td style="padding:10px; border:1px solid #eee; text-align:right; background:#fafafa; font-weight:700;">${totalExclVat || '0.00'} ${strCurrency || ''}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding:18px 24px; border-top:1px solid #ececec; background:#fcfcfc;">
                                            <div style="font-size:12px; color:#666; line-height:1.45;">
                                                <strong>CONFIDENTIAL & DISCLAIMER NOTICE:</strong>
                                                <div style="margin-top:6px;">
                                                    The information contained in this email and any attachments is confidential and intended solely for the designated recipient. If you believe you have received this email in error, please notify the sender immediately.
                                                </div>
                                                <!--<div style="margin-top:12px;">
                                                    Thank you,<br/>
                                                    <span style="font-weight:700; color:#0a4d8c;">NiceOne Team</span>
                                                </div>-->
                                            </div>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                `;

                let objPoPDF = render.transaction({
                    entityId: Number(intRecordId),
                    printMode: render.PrintMode.PDF,
                    formId: Number(intCustomFormId)
                });

                email.send({
                    author: runtime.getCurrentUser().id,
                    body: objEmailBody,
                    recipients: strVendorEmail,
                    cc: [runtime.getCurrentUser().id],
                    subject: `Check PO #${strPoNumber}`,
                    attachments: [objPoPDF],
                    relatedRecords: {
                        transactionId: intRecordId
                    }
                });

                response.success = true;
                response.message = 'Email sent successfully.';

                context.response.write(JSON.stringify(response));
            }
        } catch (errOnRequest) {
            response.message = 'Error sending email: ' + errOnRequest.message;
            log.debug('errOnRequest', errOnRequest);

            context.response.write(JSON.stringify(response));
        }
    }

    return {
        onRequest: onRequest
    }
});
