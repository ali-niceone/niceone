/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/search', 'N/format', 'N/currentRecord', 'N/https', 'N/url'], function (search, format, currentRecord, https, url) {

    let objCurrentRecord = currentRecord.get();

    function pageInit(context) {
        try {
            if (context.mode != 'create') return;

            let urlParams = new URLSearchParams(window.location.search);
            let tranInternalId = urlParams.get('transaction');

            let tranType = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: tranInternalId,
                columns: ['recordtype']
            }).recordtype;

            if (tranType != "purchaseorder") return;

            if (!tranInternalId) return;

            let notifyAttendees = objCurrentRecord.getField('sendemail');
            notifyAttendees.isDisplay = false;

            let poData = search.lookupFields({
                type: search.Type.PURCHASE_ORDER,
                id: tranInternalId,
                columns: ['tranid', 'entity', 'location']
            });

            let poNumber = poData.tranid;
            let poVendor = poData.entity[0].text;
            let poLocation = poData.location[0].text.replace(/^\d+\s*/, '');

            let eventDate = objCurrentRecord.getValue('startdate');
            eventDate = format.format({
                value: new Date(eventDate),
                type: format.Type.DATE
            });

            let eventStartTime = formatTime(objCurrentRecord.getValue('starttime'));
            let eventEndTime = formatTime(objCurrentRecord.getValue('endtime'));

            let eventMessage = `
                (This is to confirm your appointment scheduled as follows)<br/>
                Date: ${eventDate}<br/>
                Time: ${eventStartTime} - ${eventEndTime}<br/>
                Location: ${poLocation || '(Not Specified)'}
            `;

            objCurrentRecord.setValue({
                fieldId: 'title',
                value: "PO Number: " + poNumber + " - Supplier: " + poVendor
            });
            objCurrentRecord.setValue({
                fieldId: 'message',
                value: eventMessage
            });
            objCurrentRecord.setValue({
                fieldId: 'location',
                value: poLocation
            });
        } catch (errPageInit) {
            alert('errPageInit: ' + errPageInit);
        }
    }

    function saveRecord(context) {
        try {
            showSpinner('Sending email... Please wait');

            let eventTitle = objCurrentRecord.getValue('title');
            let eventMsg = objCurrentRecord.getValue('message');

            let arrAttendees = [];
            let countAttendees = objCurrentRecord.getLineCount('attendee');
            for (let i = 0; i < countAttendees; i++) {
                let attendeeReceive = objCurrentRecord.getSublistValue({
                    sublistId: 'attendee',
                    fieldId: 'attendee',
                    line: i
                });
                if (attendeeReceive) arrAttendees.push(attendeeReceive);
            }

            if (!arrAttendees.length) {
                hideSpinner();
                alert('No attendees selected.');
                return false;
            }

            let suiteletURL = url.resolveScript({
                deploymentId: 'customdeploy_no_sl_event_template',
                scriptId: 'customscript_no_sl_event_template'
            });

            let payload = JSON.stringify({
                recipients: arrAttendees,
                subject: eventTitle,
                body: eventMsg
            });

            let response = https.request({
                method: https.Method.POST,
                url: suiteletURL,
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });

            hideSpinner();

            if (!response || !response.body) {
                alert('No response from Suitelet.');
                return false;
            }

            let result;
            try {
                result = JSON.parse(response.body);
            } catch (jsonErr) {
                alert('Invalid response format from Suitelet: ' + response.body);
                return false;
            }

            if (result.success) {
                alert('✅ Email sent successfully.');
                // Close the popup after short delay
                setTimeout(() => window.close(), 500);
                return true; // allow record save
            } else {
                alert('❌ Failed to send email: ' + result.message);
                return false;
            }

        } catch (errSaveRecord) {
            hideSpinner();
            alert('Error in saveRecord: ' + errSaveRecord.message);
            return false;
        }
    }

    function formatTime(dateValue) {
        if (!dateValue) return '';
        let dateObj = new Date(dateValue);
        let hours = dateObj.getHours();
        let minutes = dateObj.getMinutes();
        let ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // convert "0" to "12"
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
    }

    function showSpinner(msg) {
        let overlay = document.createElement('div');
        overlay.id = 'no-email-spinner';
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255,255,255,0.8); z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: Arial; color: #333;
        `;
        overlay.innerHTML = `
            <div style="border: 4px solid #ccc; border-top: 4px solid #0077cc;
                border-radius: 50%; width: 50px; height: 50px;
                animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 15px; font-size: 14px;">${msg}</div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);
    }

    function hideSpinner() {
        let overlay = document.getElementById('no-email-spinner');
        if (overlay) overlay.remove();
    }

    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    }
});
