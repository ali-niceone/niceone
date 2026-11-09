/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * File:   /SuiteScripts/client/cs_po_rate_change_review.js
 *
 * Responsibility: Opens the rate change review Suitelet as a centered popup.
 *                 All approve/reject logic, mutual exclusivity, and Approve All /
 *                 Reject All are handled inside the Suitelet's raw HTML — this CS
 *                 only handles the button click.
 */

define(['N/currentRecord', 'N/url', 'N/log'],
    function (currentRecord, url, log) {

        const POPUP_WIDTH = 1100;
        const POPUP_HEIGHT = 700;

        function pageInit(context) { /* no-op – button added server-side by UE beforeLoad */ }

        function openRateChangeReview() {
            try {
                const rec = currentRecord.get();
                const poId = rec && rec.id;
                if (!poId) {
                    alert('Please save the Purchase Order first.');
                    return;
                }

                const slUrl = url.resolveScript({
                    scriptId: 'customscript_sl_po_rate_change_review',
                    deploymentId: 'customdeploy_sl_po_rate_change_review',
                    params: { poid: poId, paramtype: 'ratechange' }
                });

                const left = Math.max(0, Math.round((screen.width - POPUP_WIDTH) / 2));
                const top = Math.max(0, Math.round((screen.height - POPUP_HEIGHT) / 2));

                const popup = window.open(
                    slUrl,
                    'RateChangeReview',
                    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},` +
                    `left=${left},top=${top},` +
                    `resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
                );

                if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                    alert('Popup was blocked. Please allow popups for NetSuite in your browser settings and try again.');
                }

            } catch (e) {
                log.error({ title: 'CS openRateChangeReview Error', details: e.toString() });
                alert('Error opening rate change review: ' + e.message);
            }
        }

        return {
            pageInit: pageInit,
            openRateChangeReview: openRateChangeReview
        };
    });