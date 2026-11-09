/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/url', 'N/ui/message'], function (url, message) {

    function showLoadingSpinner() {
        let spinner = document.createElement("div");
        spinner.id = "loadingSpinnerOverlay";
        spinner.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    border: 6px solid #f3f3f3;
                    border-top: 6px solid #3498db;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    animation: spin 1s linear infinite;
                "></div>
                <span style="margin-left: 15px; font-size: 16px; color: #333;">Sending email, please wait...</span>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(spinner);
    }

    function hideLoadingSpinner() {
        let spinner = document.getElementById("loadingSpinnerOverlay");
        if (spinner) {
            spinner.remove();
        }
    }

    function emailPO(recordType, recordId) {
        try {
            let strScriptURL = url.resolveScript({
                deploymentId: 'customdeploy_no_sl_email_po',
                scriptId: 'customscript_no_sl_email_po',
                params: {
                    'recordType': recordType,
                    'recordId': recordId
                }
            });

            // Show spinner while waiting
            showLoadingSpinner();

            fetch(strScriptURL)
                .then(response => response.json())
                .then(result => {
                    hideLoadingSpinner();

                    if (result.success) {
                        message.create({
                            title: "Success",
                            message: "Email sent to vendor!",
                            type: message.Type.CONFIRMATION
                        }).show();
                    } else {
                        message.create({
                            title: "Error",
                            message: "Failed to send email.",
                            type: message.Type.ERROR
                        }).show();
                    }

                    location.reload();
                })
                .catch(error => {
                    hideLoadingSpinner();

                    message.create({
                        title: "Error",
                        message: "Error calling Suitelet: " + error,
                        type: message.Type.ERROR
                    }).show();
                });
        } catch (errEmailPO) {
            hideLoadingSpinner();

            message.create({
                title: "Error",
                message: "An unexpected error occurred: " + errEmailPO,
                type: message.Type.ERROR
            }).show();
        }
    }

    return {
        pageInit: function () {
            return true;
        },
        emailPO: emailPO
    }
});
