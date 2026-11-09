/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/email', 'N/runtime', 'N/error'], function (search, email, runtime, error) {

    function beforeSubmit(context) {
        // if (runtime.executionContext !== runtime.ContextType.CSV_IMPORT) return;
        if (runtime.executionContext !== runtime.ContextType.SUITELET) return;

        const rec = context.newRecord;
        const lineCount = rec.getLineCount({ sublistId: 'item' });
        const headerLocation = rec.getValue('location'); // header location
        if (!headerLocation || lineCount === 0) return;

        // 1) Aggregate TO quantities by item id
        const toQtyByItem = {}; // { itemId: totalQty }
        for (let i = 0; i < lineCount; i++) {
            const itemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
            const qty = Number(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })) || 0;
            if (!itemId || qty === 0) continue;
            toQtyByItem[itemId] = (toQtyByItem[itemId] || 0) + qty;
        }
        const itemIds = Object.keys(toQtyByItem);
        if (itemIds.length === 0) return;

        // 2) Single inventorybalance search: GROUP by item and SUM onhand, filter by header location
        const invSearch = search.create({
            type: 'inventorybalance',
            filters: [
                ['item', 'anyof', itemIds],
                'AND',
                ['location', 'anyof', headerLocation]
            ],
            columns: [
                search.createColumn({ name: 'item', summary: search.Summary.GROUP }),
                search.createColumn({ name: 'onhand', summary: search.Summary.SUM })
            ]
        });

        // 3) Collect SUM(onhand) per item (handle >1000 rows if necessary)
        const onhandByItem = {};
        let start = 0;
        const pageSize = 1000;
        let results;
        do {
            results = invSearch.run().getRange({ start: start, end: start + pageSize }) || [];
            for (let r = 0; r < results.length; r++) {
                const row = results[r];
                const id = row.getValue({ name: 'item', summary: search.Summary.GROUP });
                const sumOnhand = Number(row.getValue({ name: 'onhand', summary: search.Summary.SUM })) || 0;
                onhandByItem[id] = (onhandByItem[id] || 0) + sumOnhand;
            }
            start += pageSize;
        } while (results.length === pageSize);

        // 4) Compare aggregates and collect failures (treat missing inventorybalance rows as 0 onhand)
        const failures = [];
        for (const id of itemIds) {
            const toQty = toQtyByItem[id] || 0;
            const onhand = onhandByItem[id] || 0;
            if (toQty > onhand) {
                let itemName = id;
                const lf = search.lookupFields({ type: 'item', id: id, columns: ['displayname', 'itemid'] });
                itemName = lf.displayname || lf.itemid || id;

                failures.push({
                    id: id,
                    name: itemName,
                    toQty: toQty,
                    onhand: onhand
                });
            }
        }

        if (failures.length) {
            const authorId = runtime.getCurrentUser().id;
            const recipients = [4990066]; // adjust recipient(s) as needed
            const headerLocationName = search.lookupFields({ type: 'location', id: headerLocation, columns: 'name' }).name;

            const body = 'Transfer Order blocked — requested qty exceeds on-hand at ' + headerLocationName + ':\n\n' +
                failures.map(f => `- ${f.name} (id:${f.id}) => TO qty: ${formatNumber(f.toQty)}, OnHand: ${formatNumber(f.onhand)}`).join('\n');

            email.send({ author: authorId, recipients: recipients, subject: 'Blocked Transfer Order: insufficient on-hand', body: body });

            throw 'Transfer Order blocked: requested qty exceeds on-hand at ' + headerLocationName + '.';
        }
    }

    function formatNumber(num) {
        return Number(num || 0).toLocaleString('en-US');
    }

    return { beforeSubmit: beforeSubmit };
});
