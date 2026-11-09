/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/search', 'N/format'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{format} format
 */
    (record, search, format) => {

        const CUSTOM_RECORD = 'customrecord_fiscal_year_option';

        const FIELD = {
            accountingPeriod: 'custrecord_fy_id',
            name: 'custrecord_fy_name',
            startDate: 'custrecord_fy_start_date',
            endDate: 'custrecord_fy_end_date',
            inactive: 'isinactive'
        };

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                const existingOptions = getExistingOptions();
                const accountingYears = getAccountingYears();

                accountingYears.forEach(period => {
                    const periodId = String(period.id);
                    const existingId = existingOptions[periodId];

                    const values = {
                        [FIELD.accountingPeriod]: period.id,
                        [FIELD.startDate]: parseDate(period.startDate),
                        [FIELD.endDate]: parseDate(period.endDate),
                        isinactive: period.closed
                    };

                    if (existingId) {
                        // Update existing fiscal-year option.
                        record.submitFields({
                            type: CUSTOM_RECORD,
                            id: existingId,
                            values: {
                                name: period.name,
                                [FIELD.name]: period.name,
                                [FIELD.startDate]: values[FIELD.startDate],
                                [FIELD.endDate]: values[FIELD.endDate],
                                isinactive: values.isinactive
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });

                        log.audit({
                            title: 'Fiscal-year option updated',
                            details: {
                                recordId: existingId,
                                periodId,
                                periodName: period.name,
                                inactive: period.closed
                            }
                        });

                        return;
                    }

                    // Create a new option.
                    const fiscalYear = record.create({
                        type: CUSTOM_RECORD,
                        isDynamic: false
                    });

                    // This is the standard custom-record Name field.
                    fiscalYear.setValue({
                        fieldId: 'name',
                        value: period.name
                    });

                    fiscalYear.setValue({
                        fieldId: FIELD.name,
                        value: period.name
                    });

                    fiscalYear.setValue({
                        fieldId: FIELD.accountingPeriod,
                        value: period.id
                    });

                    if (values[FIELD.startDate]) {
                        fiscalYear.setValue({
                            fieldId: FIELD.startDate,
                            value: values[FIELD.startDate]
                        });
                    }

                    if (values[FIELD.endDate]) {
                        fiscalYear.setValue({
                            fieldId: FIELD.endDate,
                            value: values[FIELD.endDate]
                        });
                    }

                    fiscalYear.setValue({
                        fieldId: FIELD.inactive,
                        value: period.closed
                    });

                    const newId = fiscalYear.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });

                    log.audit({
                        title: 'Fiscal-year option created',
                        details: {
                            recordId: newId,
                            periodId,
                            periodName: period.name,
                            inactive: period.closed
                        }
                    });
                });
            } catch (errExecute) {
                log.debug('errExecute', errExecute);
            }
        }

        function getAccountingYears() {
            const years = [];

            search.create({
                type: search.Type.ACCOUNTING_PERIOD,
                filters: [
                    ['isyear', 'is', 'T']
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: 'periodname'
                    }),
                    search.createColumn({
                        name: 'startdate'
                    }),
                    search.createColumn({
                        name: 'enddate'
                    }),
                    search.createColumn({
                        name: 'closed'
                    })
                ]
            }).run().each(result => {
                years.push({
                    id: result.getValue({
                        name: 'internalid'
                    }),
                    name: result.getValue({
                        name: 'periodname'
                    }),
                    startDate: result.getValue({
                        name: 'startdate'
                    }),
                    endDate: result.getValue({
                        name: 'enddate'
                    }),
                    closed: result.getValue({
                        name: 'closed'
                    }) === true ||
                        result.getValue({
                            name: 'closed'
                        }) === 'T'
                });

                return true;
            });

            return years;
        }

        function getExistingOptions() {
            const options = {};

            search.create({
                type: CUSTOM_RECORD,
                filters: [],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: FIELD.accountingPeriod
                    })
                ]
            }).run().each(result => {
                const periodId = result.getValue({
                    name: FIELD.accountingPeriod
                });

                if (periodId) {
                    options[String(periodId)] = result.getValue({
                        name: 'internalid'
                    });
                }

                return true;
            });

            return options;
        }

        function parseDate(value) {
            if (!value) {
                return null;
            }

            return format.parse({
                value,
                type: format.Type.DATE
            });
        }

        return { execute }

    });
