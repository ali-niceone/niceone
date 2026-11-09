/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * Script Name:  MR_UpdateInventoryFields.js
 * Description:  Reads an Inventory Item saved search and updates
 *               "custitem_max_coverage"  (MAX COVERAGE) and
 *               "custitem_required_doc"  (REQUIRED DOC)
 *               with a random integer between 15 and 90 for every result.
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────────
 *  1. Replace SAVED_SEARCH_ID  with your actual saved-search ID  (e.g. 'customsearch_inv_list').
 *  2. Replace the two field-ID constants with the real internal IDs of your
 *     custom fields (check Setup > Customisation > Item Fields).
 *  3. Upload this file, create a Map/Reduce script record pointing to it,
 *     deploy on the Inventory Item record type, and run.
 * ──────────────────────────────────────────────────────────────────────────────
 */

define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    // ── CONFIGURATION ────────────────────────────────────────────────────────
    const SAVED_SEARCH_ID = 'customsearch_inventory_item_coverage_sto';
    const FIELD_MAX_COV = 'custitem_max_coverage';
    const FIELD_REQ_DOC = 'custitem_required_doc';
    const MIN_VAL = 15;
    const MAX_VAL = 90;
    // ─────────────────────────────────────────────────────────────────────────

    /** Returns a random integer between min and max (inclusive). */
    const randomInt = (min, max) =>
        Math.floor(Math.random() * (max - min + 1)) + min;

    // ── GET INPUT STAGE ──────────────────────────────────────────────────────
    const getInputData = () => {
        log.debug('getInputData', `Loading saved search: ${SAVED_SEARCH_ID}`);
        return search.load({ id: SAVED_SEARCH_ID });
    };

    // ── MAP STAGE ────────────────────────────────────────────────────────────
    // Each search result is passed here individually.
    // Key = internal ID, Value = record type (always 'inventoryitem' here).
    const map = (context) => {
        const result = JSON.parse(context.value);
        const internalId = result.id;
        const recordType = result.recordType;   // e.g. 'inventoryitem', 'assemblyitem', etc.

        context.write({
            key: internalId,
            value: recordType
        });
    };

    // ── REDUCE STAGE ─────────────────────────────────────────────────────────
    // All values for the same key arrive together – here each key is unique so
    // there will always be exactly one value per key.
    const reduce = (context) => {
        const internalId = context.key;
        const recordType = context.values[0];

        const maxCovVal = randomInt(MIN_VAL, MAX_VAL);
        const reqDocVal = randomInt(MIN_VAL, maxCovVal);
        const avgDailyForecast = randomInt(MIN_VAL, 50);

        try {
            /* record.submitFields({
                type: recordType,
                id: internalId,
                values: {
                    [FIELD_MAX_COV]: maxCovVal,
                    [FIELD_REQ_DOC]: reqDocVal
                },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            }); */
            record.submitFields({
                type: recordType,
                id: internalId,
                values: {
                    'custitem_inner_status': 1,
                    'custitem_average_daily_forecast': avgDailyForecast,
                },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });

            log.debug('Updated', `ID ${internalId} → ${FIELD_MAX_COV}=${maxCovVal}, ${FIELD_REQ_DOC}=${reqDocVal}`);
        } catch (e) {
            log.debug('Update failed', `ID ${internalId} | ${e.message}`);
        }
    };

    // ── SUMMARISE STAGE ──────────────────────────────────────────────────────
    const summarize = (summary) => {
        log.debug('Summary', `Usage: ${JSON.stringify(summary.usage)}`);

        summary.mapSummary.errors.iterator().each((key, error) => {
            log.debug('Map error', `Key ${key}: ${error}`);
            return true;
        });

        summary.reduceSummary.errors.iterator().each((key, error) => {
            log.debug('Reduce error', `Key ${key}: ${error}`);
            return true;
        });

        log.debug('summarize', 'Mass update complete.');
    };

    return { getInputData, map, reduce, summarize };
});