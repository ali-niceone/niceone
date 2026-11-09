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
        else if (!isNotEmptyOrNull(strRecordType) && strRecordType.indexOf('item') == -1) {
            throw 'Record type is not valid';
        }

        let arrRecordData = [];

        let objLoadRecord = record.load({
            type: strRecordType,
            id: intRecordId
        });

        let intBinCount = objLoadRecord.getLineCount('binnumber');
        for (let i = 0; i < intBinCount; i++) {
            let blPreferredBin = objLoadRecord.getSublistValue({
                sublistId: 'binnumber',
                fieldId: 'preferredbin',
                line: i
            });

            if (blPreferredBin == true) {
                let strBinNumber = objLoadRecord.getSublistText({
                    sublistId: 'binnumber',
                    fieldId: 'binnumber',
                    line: i
                });

                let strBinLocation = objLoadRecord.getSublistText({
                    sublistId: 'binnumber',
                    fieldId: 'location',
                    line: i
                });

                arrRecordData.push({
                    recordId: intRecordId,
                    recordType: strRecordType,
                    binNumber: strBinNumber,
                    binLocation: strBinLocation
                });

                break;
            }
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
