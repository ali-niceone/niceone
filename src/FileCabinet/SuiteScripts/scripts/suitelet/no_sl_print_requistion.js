/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/render', 'N/format', 'N/config'], function (record, search, render, format, config) {

    function onRequest(context) {
        try {
            let objServerRequest = context.request;
            let objServerResponse = context.response;
            let objParams = objServerRequest.parameters;

            if (objServerRequest.method == 'GET') {
                let intRecordId = objParams.recordId;

                let objRequisitionData = {};

                let objLoadRequisitionRecord = record.load({
                    type: record.Type.PURCHASE_REQUISITION,
                    id: intRecordId
                });

                let strVendor = objLoadRequisitionRecord.getText('entity');
                let strTranNo = objLoadRequisitionRecord.getValue('tranid');
                let dtTranDate = objLoadRequisitionRecord.getValue('trandate');
                dtTranDate = format.format({
                    value: new Date(dtTranDate),
                    type: format.Type.DATE
                });

                let strCurrency = objLoadRequisitionRecord.getText('currency');

                let fltEstimatedTotal = objLoadRequisitionRecord.getValue('estimatedtotal');
                fltEstimatedTotal = format.format({
                    value: fltEstimatedTotal,
                    type: format.Type.CURRENCY
                });

                let fltTotal = objLoadRequisitionRecord.getValue('total');
                fltTotal = format.format({
                    value: fltTotal,
                    type: format.Type.CURRENCY
                });

                let arrItemLineData = [];
                let intItemLineCount = objLoadRequisitionRecord.getLineCount('item');
                for (let i = 0; i < intItemLineCount; i++) {
                    let strItem = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    let poVendorId = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'povendor',
                        line: i
                    });

                    let vendorTerms = '';
                    if (poVendorId) {
                        vendorTerms = search.lookupFields({
                            type: search.Type.VENDOR,
                            id: poVendorId,
                            columns: 'terms'
                        }).terms[0].text;
                    }

                    let strBarcode = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_no_barcode',
                        line: i
                    });

                    let strDisplayName = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_no_disp_nam_lin',
                        line: i
                    });

                    let strOpenCartImg = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol11',
                        line: i
                    });

                    let strUnits = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'units',
                        line: i
                    });

                    let intQuantity = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    let fltAmount = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    });
                    fltAmount = format.format({
                        value: fltAmount,
                        type: format.Type.CURRENCY
                    });

                    let strCurrency = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'currency',
                        line: i
                    });

                    arrItemLineData.push({
                        'item': strItem,
                        'custcol_no_barcode': strBarcode,
                        'custcol_no_disp_nam_lin': strDisplayName,
                        'custcol11': strOpenCartImg,
                        'units': strUnits,
                        'quantity': intQuantity,
                        'amount': fltAmount,
                        'currency': strCurrency,
                        'vendorTerms': vendorTerms
                    });
                }

                let arrExpenseLineData = [];
                let intExpenseLineCount = objLoadRequisitionRecord.getLineCount('expense');
                for (let i = 0; i < intExpenseLineCount; i++) {
                    let strCategory = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'category',
                        line: i
                    });

                    let strAccount = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'account',
                        line: i
                    });

                    let strPoVendor = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'povendor',
                        line: i
                    });

                    let poVendorId = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'povendor',
                        line: i
                    });

                    let vendorTerms = null;
                    if (poVendorId) {
                        vendorTerms = search.lookupFields({
                            type: search.Type.VENDOR,
                            id: poVendorId,
                            columns: 'terms'
                        }).terms[0]?.text ?? '';
                    }

                    let fltAmount = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'amount',
                        line: i
                    });
                    fltAmount = format.format({
                        value: fltAmount,
                        type: format.Type.CURRENCY
                    });

                    let strMemo = objLoadRequisitionRecord.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'memo',
                        line: i
                    });

                    let strDepartment = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'department',
                        line: i
                    });

                    let strLocation = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'location',
                        line: i
                    });

                    let strLinkedORder = objLoadRequisitionRecord.getSublistText({
                        sublistId: 'expense',
                        fieldId: 'linkedorder',
                        line: i
                    });

                    arrExpenseLineData.push({
                        'category': strCategory,
                        'account': strAccount,
                        'povendor': strPoVendor,
                        'amount': fltAmount,
                        'memo': strMemo,
                        'department': strDepartment,
                        'location': strLocation,
                        'linkedorder': strLinkedORder,
                        'vendorTerms': vendorTerms
                    });
                }

                let objConfig = config.load({
                    type: config.Type.COMPANY_INFORMATION
                });

                let strAddress = objConfig.getValue('mainaddress_text');
                let strShippingAddress = objConfig.getValue('shippingaddress_text');

                let objCompanyInformation = {
                    'addressText': strAddress,
                    'shippingaddress_text': strShippingAddress
                }

                objRequisitionData = {
                    'entity': strVendor,
                    'tranid': strTranNo,
                    'trandate': dtTranDate,
                    'currency': strCurrency,
                    'estimatedtotal': fltEstimatedTotal,
                    'total': fltTotal,
                    'companyInformation': objCompanyInformation,
                    'item': arrItemLineData,
                    'expense': arrExpenseLineData
                };

                let objRenderer = render.create();
                objRenderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "record",
                    data: objRequisitionData
                });
                objRenderer.setTemplateByScriptId('CUSTTMPL_344_4952825_SB1_985');

                let objPDF = objRenderer.renderAsPdf();
                objPDF.name = "Purchase_Requisition_" + objRequisitionData.tranid + ".pdf";

                objServerResponse.writeFile({
                    file: objPDF,
                    isInline: true
                });
                // objServerResponse.write(JSON.stringify(objRequisitionData));
            }
        } catch (errOnRequest) {
            log.debug('errOnRequest', errOnRequest);
        }
    }

    return {
        onRequest: onRequest
    }
});
