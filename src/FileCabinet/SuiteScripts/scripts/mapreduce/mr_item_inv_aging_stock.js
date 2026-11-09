/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * Item Stock Ledger - calculation engine (Item, Beginning Inv Qty On-hand, Ending Inv Qty On-hand).
 *
 * Submitted by sl_item_inv_aging_stock.js through N/task. One map call per inventory item:
 *   Beginning Inv Qty On-hand = SUM(quantity) of lines dated BEFORE the From Date
 *   Ending Inv Qty On-hand    = SUM(quantity) of lines dated UP TO the To Date
 * counting only the lines of the saved search: mainline F, posted, the GL line on the
 * item's own inventory asset account, primary book, subsidiary on the line, quantity <> 0.
 * Summarize collects all rows, adds the totals and saves ONE JSON result file in the
 * File Cabinet. The Suitelet renders the page and the CSV from that file.
 *
 * There is no reduce stage on purpose: map output goes straight to summarize.
 *
 * Script parameters (create on the script record, all "Free-Form Text"):
 *   custscript_stk_subsidiary   internal id of the subsidiary
 *   custscript_stk_from_iso     From Date as DD/MM/YYYY
 *   custscript_stk_to_iso       To Date as DD/MM/YYYY
 *   custscript_stk_run_key      unique key, becomes the result file name
 *   custscript_stk_folder_id    File Cabinet folder internal id for the result files
 * (The ids and the file prefix keep their names because the Suitelet uses them.)
 */
define(['N/query', 'N/runtime', 'N/file', 'N/format', 'N/search', 'N/log'],
    (query, runtime, file, format, search, log) => {

        const PARAM = {
            subsidiary: 'custscript_stk_subsidiary',
            fromIso: 'custscript_stk_from_iso',
            toIso: 'custscript_stk_to_iso',
            runKey: 'custscript_stk_run_key',
            folderId: 'custscript_stk_folder_id'
        };

        const RESULT_PREFIX = 'item_inv_aging_'; // must match the Suitelet
        const RESULT_KEEP_DAYS = 7;

        // Item types that carry stock. Add others here if your account needs them.
        const ITEM_TYPES = ['InvtPart'];

        const EPSILON = 0.000001;

        // ---------------------------------------------------------------------
        // Stages
        // ---------------------------------------------------------------------
        // Returned as an object so the map key is the item's internal id
        // (a SuiteQL input would use the row position, which is useless in error messages)
        const getInputData = () => {
            const items = {};
            const paged = query.runSuiteQLPaged({
                query: `SELECT id, itemid, assetaccount FROM item WHERE itemtype IN (${ITEM_TYPES.map((t) => `'${t}'`).join(',')})`,
                pageSize: 1000
            });

            paged.pageRanges.forEach((range) => {
                paged.fetch({ index: range.index }).data.asMappedResults().forEach((r) => {
                    // assetaccount is the item's inventory GL account ({item.assetaccount.id})
                    items[String(r.id)] = {
                        name: String(r.itemid),
                        account: r.assetaccount ? String(r.assetaccount) : ''
                    };
                });
            });
            return items;
        };

        const map = (context) => {
            const cfg = getConfig();
            const itemId = context.key;
            const input = JSON.parse(context.value);

            try {
                // An item without an inventory asset account cannot have stock-ledger lines
                if (!input.account) return;

                const qty = getQuantities(itemId, input.account, cfg);

                // Nothing before the From Date and nothing at the To Date: not a stock row
                if (Math.abs(qty.beginning) < EPSILON && Math.abs(qty.ending) < EPSILON) return;

                context.write({
                    key: String(itemId),
                    value: {
                        item: input.name,
                        beginningQty: roundQty(qty.beginning),
                        endingQty: roundQty(qty.ending)
                    }
                });
            } catch (e) {
                throw new Error(`Item ${itemId} (${input.name}): ${e.message || e}`);
            }
        };

        const summarize = (context) => {
            const cfg = getConfig();

            const rows = [];
            context.output.iterator().each((key, value) => {
                rows.push(JSON.parse(value));
                return true;
            });
            rows.sort((a, b) => String(a.item).localeCompare(String(b.item)));

            // Collect problems so the Suitelet can warn that the report may be incomplete
            let errorCount = 0;
            const errors = [];

            if (context.inputSummary.error) {
                errorCount++;
                errors.push(`Input: ${errorText(context.inputSummary.error)}`);
            }
            context.mapSummary.errors.iterator().each((key, err) => {
                errorCount++;
                if (errors.length < 20) {
                    const text = errorText(err);
                    errors.push(/^Item /.test(text) ? text : `Item ${key} (internal id): ${text}`);
                }
                return true;
            });

            const totals = { beginningQty: 0, endingQty: 0 };
            rows.forEach((row) => {
                totals.beginningQty += row.beginningQty;
                totals.endingQty += row.endingQty;
            });
            totals.beginningQty = roundQty(totals.beginningQty);
            totals.endingQty = roundQty(totals.endingQty);

            const payload = {
                meta: {
                    subsidiaryId: cfg.subsidiaryId,
                    fromIso: cfg.fromIso,
                    toIso: cfg.toIso
                },
                generatedAt: format.format({ value: new Date(), type: format.Type.DATETIME }),
                errorCount,
                errors,
                rows,
                totals
            };

            const fileId = file.create({
                name: `${RESULT_PREFIX}${cfg.runKey}.json`,
                fileType: file.Type.JSON,
                contents: JSON.stringify(payload),
                folder: Number(cfg.folderId)
            }).save();

            log.audit({
                title: 'Stock ledger result saved',
                details: `file ${fileId}: ${rows.length} item(s), ${errorCount} error(s)`
            });

            cleanupOldResults(cfg.folderId, fileId);
        };

        // ---------------------------------------------------------------------
        // Config
        // ---------------------------------------------------------------------
        function getConfig() {
            const script = runtime.getCurrentScript();
            const get = (name) => script.getParameter({ name });

            const cfg = {
                subsidiaryId: Number(get(PARAM.subsidiary)),
                fromIso: String(get(PARAM.fromIso) || ''),
                toIso: String(get(PARAM.toIso) || ''),
                runKey: String(get(PARAM.runKey) || ''),
                folderId: get(PARAM.folderId)
            };

            if (!Number.isInteger(cfg.subsidiaryId) || cfg.subsidiaryId <= 0) {
                throw new Error(`Invalid subsidiary parameter: ${get(PARAM.subsidiary)}`);
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(cfg.toIso)) {
                throw new Error('From/To date parameters must be YYYY-MM-DD.');
            }
            if (!/^[0-9_]+$/.test(cfg.runKey)) throw new Error('Invalid run key parameter.');
            if (!cfg.folderId) throw new Error('Result folder parameter is not set.');

            return cfg;
        }

        // ---------------------------------------------------------------------
        // Quantities for one item: ONE aggregate row, so no row cap or paging is involved
        // ---------------------------------------------------------------------
        function getQuantities(itemId, account, cfg) {
            const item = Number(itemId);
            const assetAccount = Number(account);
            if (!Number.isInteger(item) || item <= 0) throw new Error(`Invalid item id: ${itemId}`);
            if (!Number.isInteger(assetAccount) || assetAccount <= 0) throw new Error('No inventory asset account.');

            const fromSql = isoToSqlDate(cfg.fromIso); // DD/MM/YYYY
            const toSql = isoToSqlDate(cfg.toIso);

            const sql = `
                SELECT SUM(CASE WHEN t.trandate < TO_DATE('${fromSql}', 'DD/MM/YYYY') THEN tl.quantity ELSE 0 END) AS beginning_qty,
                       SUM(CASE WHEN t.trandate <= TO_DATE('${toSql}', 'DD/MM/YYYY') THEN tl.quantity ELSE 0 END) AS ending_qty
                FROM transaction t
                INNER JOIN transactionLine tl
                    ON tl.transaction = t.id
                INNER JOIN transactionAccountingLine tal
                    ON tal.transaction = tl.transaction
                   AND tal.transactionline = tl.id
                INNER JOIN accountingBook ab
                    ON ab.id = tal.accountingbook
                WHERE tl.item = ${item}
                  AND tl.mainline = 'F'
                  AND t.posting = 'T'
                  AND tal.posting = 'T'
                  AND ab.isprimary = 'T'
                  AND tal.account = ${assetAccount}
                  AND tl.subsidiary = ${cfg.subsidiaryId}
                  AND tl.quantity <> 0`;

            const rows = query.runSuiteQL({ query: sql }).asMappedResults();
            const row = rows.length ? rows[0] : {};

            return {
                beginning: Number(row.beginning_qty) || 0,
                ending: Number(row.ending_qty) || 0
            };
        }

        // ---------------------------------------------------------------------
        // Housekeeping
        // ---------------------------------------------------------------------
        function cleanupOldResults(folderId, keepFileId) {
            try {
                const stale = [];
                search.create({
                    type: 'file',
                    filters: [
                        ['folder', 'anyof', folderId], 'AND',
                        ['name', 'startswith', RESULT_PREFIX], 'AND',
                        ['created', 'before', `daysago${RESULT_KEEP_DAYS}`]
                    ],
                    columns: ['internalid']
                }).run().each((r) => {
                    if (String(r.id) !== String(keepFileId)) stale.push(r.id);
                    return stale.length < 100;
                });

                stale.forEach((id) => file.delete({ id }));
            } catch (e) {
                log.error({ title: 'Result cleanup failed', details: e });
            }
        }

        function errorText(err) {
            try {
                const parsed = typeof err === 'string' ? JSON.parse(err) : err;
                return String(parsed.message || parsed.name || err);
            } catch (e) {
                return String(err);
            }
        }

        // ---------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------
        // 2026-10-31 -> 31/10/2026 (the SQL mask is DD/MM/YYYY)
        function isoToSqlDate(iso) {
            const [yyyy, mm, dd] = String(iso).split('-');
            return `${dd}/${mm}/${yyyy}`;
        }

        function roundQty(value) {
            const n = Number(value);
            return Math.round((Number.isFinite(n) ? n : 0) * 1000000) / 1000000;
        }

        return { getInputData, map, summarize };
    });