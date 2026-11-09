/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/log'], function (search, log) {

    function getInputData() {
        return search.create({
            type: search.Type.SAVED_SEARCH,
            filters: [
                ['aslistview', search.Operator.IS, true],
                'AND',
                ['public', search.Operator.IS, true],
                'AND',
                ['recordtype', search.Operator.ANYOF, 'Transaction']
            ],
            columns: ['id', 'title', 'aslistview']
        });
    }

    function map(context) {
        let searchResult = JSON.parse(context.value);
        log.debug('searchResult', searchResult);

        let savedSearchId = searchResult.values['id'];  // internal numeric ID

        try {
            let loadedSearch = search.load({ id: savedSearchId });

            loadedSearch.aslistview = false;  // uncheck "Available as List View"

            loadedSearch.save();

            log.debug('Updated', 'Saved search ' + savedSearchId + ' — isList set to false');
        } catch (e) {
            log.debug('Error updating search ' + savedSearchId, e.message);
        }
    }

    function summarize(context) {
        log.debug('MapReduce Complete', 'All saved searches processed');
        context.mapSummary.errors.iterator().each(function (key, error) {
            log.debug('Map error for key ' + key, error);
            return true;
        });
    }

    return { getInputData, map, summarize };
});