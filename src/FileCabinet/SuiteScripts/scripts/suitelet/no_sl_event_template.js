/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/email', 'N/runtime'], (email, runtime) => {

    function onRequest(context) {
        try {
            if (context.request.method !== 'POST') {
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Unsupported method: ' + context.request.method
                }));
                return;
            }

            let reqBody;
            try {
                reqBody = JSON.parse(context.request.body);
            } catch (parseErr) {
                log.error('Invalid JSON received', context.request.body);
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Invalid request format'
                }));
                return;
            }

            let { recipients, subject, body } = reqBody;
            if (!recipients || !recipients.length) throw 'No recipients provided.';
            if (!subject) throw 'Missing subject.';
            if (!body) throw 'Missing body.';

            let authorId = runtime.getCurrentUser().id;

            log.debug('Email parameters', { authorId, recipients, subject });

            if (recipients.length > 1) {
                email.sendBulk({
                    author: authorId,
                    recipients: recipients,
                    subject: subject,
                    body: body
                });
            } else {
                email.send({
                    author: authorId,
                    recipients: recipients[0],
                    subject: subject,
                    body: body
                });
            }

            context.response.write(JSON.stringify({
                success: true,
                message: 'Email sent successfully.'
            }));
        } catch (err) {
            log.error('Suitelet Error', err);
            context.response.write(JSON.stringify({
                success: false,
                message: err.message || err
            }));
        }
    }

    return { onRequest };
});
