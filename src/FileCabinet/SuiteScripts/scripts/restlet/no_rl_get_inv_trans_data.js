/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/record', 'N/format'], function (record, format) {

    function _get(context) {
        let intRecordId = context.recordId;
        let strRecordType = context.recordType;

        if (!isNotEmptyOrNull(intRecordId)) {
            throw 'Record does not exist';
        }
        else if (!isNotEmptyOrNull(strRecordType) && strRecordType !== 'inventorytransfer') {
            throw 'Record type is not valid';
        }

        let arrRecordData = [];

        let objLoadRecord = record.load({
            type: strRecordType,
            id: intRecordId
        });

        let intFromLocationId = objLoadRecord.getValue('location');
        let intToLocationId = objLoadRecord.getValue('transferlocation');

        let intSublistCount = objLoadRecord.getLineCount('inventory');
        for (let i = 0; i < intSublistCount; i++) {
            let intItemInternalId = objLoadRecord.getSublistValue({
                sublistId: 'inventory',
                fieldId: 'item',
                line: i
            });

            let intQuantity = objLoadRecord.getSublistValue({
                sublistId: 'inventory',
                fieldId: 'itemcount',
                line: i
            });

            let objInventoryDetailRecord = objLoadRecord.getSublistSubrecord({
                sublistId: 'inventory',
                fieldId: 'inventorydetail',
                line: i
            });

            let intInventoryDetailCount = objInventoryDetailRecord.getLineCount('inventoryassignment');
            let strSeialLotNum;
            let strFromBin;
            let strToBin;
            let dtExpireDate;
            for (let j = 0; j < intInventoryDetailCount; j++) {
                strSeialLotNum = objInventoryDetailRecord.getSublistText({
                    sublistId: 'inventoryassignment',
                    fieldId: 'issueinventorynumber',
                    line: j
                });

                strFromBin = objInventoryDetailRecord.getSublistText({
                    sublistId: 'inventoryassignment',
                    fieldId: 'binnumber',
                    line: j
                });

                strToBin = objInventoryDetailRecord.getSublistText({
                    sublistId: 'inventoryassignment',
                    fieldId: 'tobinnumber',
                    line: j
                });

                dtExpireDate = objInventoryDetailRecord.getSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'expirationdate',
                    line: j
                });
                dtExpireDate = format.format({
                    value: new Date(dtExpireDate),
                    type: format.Type.DATE
                });
            }

            arrRecordData.push({
                'fromLocation': intFromLocationId,
                'toLocation': intToLocationId,
                'itemInternalId': intItemInternalId,
                'quantity': intQuantity,
                'batchNumber': strSeialLotNum,
                'fromBin': strFromBin,
                'toBin': strToBin,
                'expireDate': dtExpireDate
            });
        }
        log.debug('arrRecordData', arrRecordData);

        return JSON.stringify(arrRecordData);
    }

    function _post(context) {

    }

    function _put(context) {

    }

    function _delete(context) {

    }

    function isNotEmptyOrNull(val) {
        if (val != '' && val != null && val != undefined && val != 0 && val != '0') {
            return true;
        }
        else {
            return false;
        }
    }

    function getAllResults(s) {
        let results = s.run()
        let searchResults = []
        let searchId = 0
        do {
            let resultSlice = results.getRange({
                start: searchId,
                end: searchId + 1000
            })
            resultSlice.forEach(function (slice) {
                searchResults.push(slice)
                searchId++
            })
        } while (resultSlice.length >= 1000);
        return searchResults
    }

    return {
        get: _get,
        /* post: _post,
        put: _put,
        delete: _delete */
    }
});
