/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {

    let objCurrentRecord = currentRecord.get();

    function fieldChanged(context) {
        try {
            let strFieldId = context.fieldId;
            let strSublistId = context.sublistId;

            if ((strSublistId == 'item' || strSublistId == 'expense') && strFieldId == 'custcol6') {
                let discount = objCurrentRecord.getCurrentSublistValue({
                    sublistId: strSublistId,
                    fieldId: strFieldId
                });

                if (discount < 0)
                    discount *= -1;

                let rateBeforeDisc = objCurrentRecord.getCurrentSublistValue({
                    sublistId: strSublistId,
                    fieldId: 'rate'
                });

                let qty = objCurrentRecord.getCurrentSublistValue({
                    sublistId: strSublistId,
                    fieldId: 'quantity'
                });

                let priceBeforeDisc = objCurrentRecord.getCurrentSublistValue({
                    sublistId: strSublistId,
                    fieldId: 'custcol_beforediscount'
                });

                let amountBeforeDisc = parseFloat(rateBeforeDisc * qty);

                if (!priceBeforeDisc) {
                    objCurrentRecord.setCurrentSublistValue({
                        sublistId: strSublistId,
                        fieldId: 'custcol_beforediscount',
                        value: amountBeforeDisc
                    });
                }

                let rateAfterDisc = parseFloat(rateBeforeDisc - discount).toFixed(2);
                // alert('fltNewAmount = ' + fltNewAmount);

                objCurrentRecord.setCurrentSublistValue({
                    sublistId: strSublistId,
                    fieldId: 'rate',
                    value: rateAfterDisc
                });
            }
        } catch (errFieldChanged) {
            alert('errFieldChanged: ' + errFieldChanged);
        }
    }

    return {
        fieldChanged: fieldChanged
    }
});
