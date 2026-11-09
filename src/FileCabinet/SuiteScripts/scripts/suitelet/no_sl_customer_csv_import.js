/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/url'],
    function (serverWidget, url) {

        function onRequest(context) {
            try {
                let form = serverWidget.createForm({
                    title: 'Customer CSV Import'
                });

                let soRedirect = url.resolveScript({
                    scriptId: 'customscript_no_sl_so_csv_template',
                    deploymentId: 'customdeploy_no_sl_so_csv_template'
                });

                let toRedirect = url.resolveScript({
                    scriptId: 'customscript_no_sl_to_csv_template',
                    deploymentId: 'customdeploy_no_sl_to_csv_template'
                });

                form.addField({
                    id: 'custpage_custom_buttons',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                }).defaultValue = `
                    <style>
                        .btn-container {
                            text-align: center;
                            margin-top: 60px;
                        }

                        .btn {
                            padding: 12px 24px;
                            border-radius: 6px;
                            text-decoration: none;
                            font-weight: bold;
                            display: inline-block;
                            min-width: 400px;
                            text-align: center;
                            margin: 10px;
                            transition: all 0.2s ease-in-out;
                            font-size: 20px;
                        }

                        .btn:hover {
                            opacity: 0.9;
                            transform: translateY(-1px);
                        }

                        .btn-1 {
                            background: #4a6fa5;
                            color: #fff;
                        }

                        .btn-2 {
                            background: #28a745;
                            color: #fff;
                        }

                        .btn-3 {
                            background: #dc3545;
                            color: #fff;
                        }
                    </style>

                    <div class="btn-container">
                        <a href="${soRedirect}"
                        target="_self"
                        class="btn btn-1">
                        Import CSV for Sales Orders
                        </a>

                        <br/>

                        <a href="${toRedirect}"
                        target="_self"
                        class="btn btn-1">
                        Import CSV for Transfer Orders
                        </a>
                    </div>
                    `;

                context.response.writePage(form);
            } catch (errOnRequest) {
                log.debug('errOnRequest', errOnRequest);
            }
        }

        return {
            onRequest: onRequest
        }
    });
