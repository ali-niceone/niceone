/**
 * @NScriptName Restlet which is used in OpenCart integration to create Order record
 * @NApiVersion 2.0
 * @NScriptType restlet
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/search'],
	function (record, search) {

		/**
		 * Opencart create Order record
		 */
		function createOrder(order_params) {

			try {

				log.debug('rest body ===========', order_params);

				return createOrderRecord(order_params);
			} catch (error) {
				log.debug('error details are===========', error);
				return { message: error.message, statusCode: 500, error: error };
			}
		}

		function createOrderRecord(order_params) {

			var srch = search.create({

				type: 'invoice',
				filters: [['custbodysalesorder_opencart_id', 'is', order_params.order_opencart_id]], //will change with id on invoice
				columns: []
			});
			var searchResult = srch.run().getRange(0, 1);
			var useInventorynumber = false;

			if (searchResult.length >= 1) {

				return { message: 'Order opencart Id (' + order_params.order_opencart_id + ') dose exist before', order_internal_id: searchResult[0].id, opencart_order_id: order_params.order_opencart_id, existing_before: true, statusCode: 400 };
			}

			if (!order_params.customer_internal_id) { return { message: 'Please provide customer ID!!!', statusCode: 400 }; }

			if (!order_params.items.length) { return { message: 'there should be one item at least!!!', statusCode: 400 }; }

			// to set the Order fields and creating Order record
			var OrderObj = record.create({
				type: 'invoice',
				isDynamic: true
			});

			//check the fields in the invoice to change it;
			OrderObj.setValue('entity', 1728563); //Default Customer (GEN1 General Customer)

			//OrderObj.setValue({ fieldId: 'entity', value:  order_params.customer_internal_id });

			OrderObj.setValue('custbody19', order_params.customer_internal_id);

			OrderObj.setValue('location', '2');//Default Value

			OrderObj.setValue('class', '1');//Default Value

			OrderObj.setValue('custbody8', '1');//Default Value

			if (order_params.order_opencart_status) { OrderObj.setValue({ fieldId: 'custbody_open_cart_status', value: order_params.order_opencart_status }); }

			// if (order_params.customer_address_internal_id)
			//   OrderObj.setValue({fieldId:'shipaddresslist',value:order_params.customer_address_internal_id });

			if (order_params.date) {
				var date = order_params.date.slice(0, 10);
				var parts = date.split('-');
				var orderDate = new Date(parts[0], parts[1] - 1, parts[2]);
				OrderObj.setValue({ fieldId: 'trandate', value: orderDate });
			}

			if (order_params.payment_method) {

				if (order_params.payment_method == 5) {
					var customerId = 1728563;
					if (order_params.shipping_carrier) {
						customerId = order_params.shipping_carrier;
					}
					OrderObj.setValue({ fieldId: 'entity', value: customerId });
				} else if (order_params.payment_method == 1) {
					OrderObj.setValue({ fieldId: 'entity', value: 1223 });
				} else if (order_params.payment_method == 2) {
					OrderObj.setValue({ fieldId: 'entity', value: 1223 });
				} else if (order_params.payment_method == 3) {
					OrderObj.setValue({ fieldId: 'entity', value: 1224 });
				} else if (order_params.payment_method == 4) {
					OrderObj.setValue({ fieldId: 'entity', value: 1224 });
				} else if (order_params.payment_method == 6) {
					//STC PAY Is Processed Through Checkout
					OrderObj.setValue({ fieldId: 'entity', value: 1224 });
				} else if (order_params.payment_method == 7) {
					OrderObj.setValue({ fieldId: 'entity', value: 1728563 });
				} else if (order_params.payment_method == 9) {
					OrderObj.setValue({ fieldId: 'entity', value: 1728830 });
				} else if (order_params.payment_method == 11) {
					OrderObj.setValue({ fieldId: 'entity', value: 8834 });
				} else if (order_params.payment_method == 12) {
					OrderObj.setValue({ fieldId: 'entity', value: 1728839 });
				} else if (order_params.payment_method == 13) {
					OrderObj.setValue({ fieldId: 'entity', value: 4015343 });
				}
			}

			if (order_params.payment_method) {
				OrderObj.setValue({ fieldId: 'custbody_payment_method', value: order_params.payment_method });//old line
			}

			if (order_params.order_opencart_id) {
				OrderObj.setValue({ fieldId: 'externalid', value: order_params.order_opencart_id });
				OrderObj.setValue({ fieldId: 'custbodysalesorder_opencart_id', value: order_params.order_opencart_id });
			}

			if (order_params.country_id) { OrderObj.setValue({ fieldId: 'custbody_shipping_country_id', value: order_params.country_id }); }

			if (order_params.shipping_carrier) { OrderObj.setValue({ fieldId: 'custbody_shipping', value: order_params.shipping_carrier }); }

			if (order_params.shipment_tracking_no) { OrderObj.setValue({ fieldId: 'custbody_oc_trak_num', value: order_params.shipment_tracking_no }); }

			// OrderObj.setValue({ fieldId: "subsidiary", value: 1 });

			for (var x = 0; x < order_params.items.length; x++) {

				var item = order_params.items[x];

				try {

					OrderObj.selectNewLine({ sublistId: 'item' });

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'item',
						value: item.item_internal_id,
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					if (item.item_internal_id == '13818') {
						item.price = item.price * item.quantity;
						item.quantity = 1;
					}

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'quantity',
						value: item.quantity,
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'price',
						value: '-1',
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'rate',
						value: item.price,
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'amount',
						value: item.price * item.quantity,
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					OrderObj.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_oc_sales_item_id',
						value: item.open_cart_line_id,
						ignoreFieldChange: false,
						fireSlavingSync: false
					});

					if (item.description) {
						OrderObj.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'description',
							value: item.description,
							ignoreFieldChange: false,
							fireSlavingSync: false
						});
					}

					if (item.taxcode) {
						OrderObj.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'taxcode',
							value: item.taxcode,
							ignoreFieldChange: false,
							fireSlavingSync: false
						});
					}

					//.................start of inventory deatail data ..........................

					//----------This will be the condition if there is inventory if not it will be fefo allocation
					if (item.inventory_details) {
						var inventoryDetailRec = OrderObj.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });

						OrderObj.commitLine({
							sublistId: 'item'
						});
					} else if (item.inventory_item == true) {

						//-----------Fefo Allocation dirctly on the items

						var data;
						var _StockAvaliable = new Array();
						// log.debug(item);
						if (useInventorynumber) {

							var filters = new Array();
							filters.push(['item.internalidnumber', 'equalto', item.item_internal_id]);
							filters.push('AND');
							filters.push(['location', search.Operator.IS, 2]);
							filters.push('AND');
							filters.push(['onhand', 'greaterthan', '0']);

							data = search.create({
								type: 'inventorybalance',
								columns: [
									'inventorynumber',
									'location',
									'onhand',
									'binnumber'
								],
								filters: filters
							}).run().getRange({
								start: 0,
								end: 1000
							});

						} else {

							var filters = new Array();
							filters.push(['item', search.Operator.IS, item.item_internal_id]);
							filters.push('AND');
							filters.push(['location', search.Operator.IS, 2]);

							data = search.create({
								type: 'inventorynumber',
								columns: [
									'internalid',
									'inventorynumber',
									'expirationdate',
									'quantityonhand',
									'quantityAvailable'
								],
								filters: filters
							}).run().getRange({
								start: 0,
								end: 1000
							});
						}

						if (data == '' || data == null) {
							log.debug('error details are===========', 'NO INVENTORY NUMBER IN item no ' + item.item_internal_id + ' does not have any inventory details');
							return { message: '--' + item.item_internal_id + '--' + item.quantity + '--', statusCode: 500, error: 'item no ' + item.item_internal_id + ' does not have any inventory details' };
						}

						var Total_quantityonhand = 0;

						for (var j = 0; data != null && j < data.length; j++) {
							var cust = data[j];

							var inventorynumberid = cust.getValue('internalid');
							var expirationdate = cust.getValue('expirationdate');
							//var inventorynumber = cust.getText('inventorynumber');
							var inventorynumber = '';
							var quantityonhand = 0;
							var quantityAvailable = -1;

							//var quantityonhand = cust.getValue('onhand');
							if (useInventorynumber) {
								inventorynumber = cust.getText('inventorynumber');
								quantityonhand = cust.getValue('onhand');
								quantityAvailable = cust.getValue('quantityAvailable');
							} else {
								inventorynumber = cust.getValue('inventorynumber');
								quantityonhand = cust.getValue('quantityonhand');
								quantityAvailable = cust.getValue('quantityAvailable');
							}

							var binNumber = cust.getValue('binnumber');

							//  log.debug('quantityAvailable '+item.item_internal_id,quantityAvailable);

							if (quantityonhand < 1 || binNumber == '' || inventorynumber == 'RT' || inventorynumber == 'rt' || quantityAvailable < 1) { continue; }

							if (quantityonhand < 1) { continue; }

							Total_quantityonhand += quantityonhand;
							_StockAvaliable.push([inventorynumber, expirationdate, quantityonhand, binNumber]);

							log.debug(item.item_internal_id, _StockAvaliable, binNumber);
						}

						if (Total_quantityonhand < item.quantity) {
							log.debug('error details are===========', 'LESS INVENTORY item no ' + item.item_internal_id + ' does not have enought inventory details only ' + Total_quantityonhand + ' is availble');
							return { message: '--' + item.item_internal_id + '--' + item.quantity + '--', statusCode: 500, error: 'item no ' + item.item_internal_id + ' does not have enought inventory details' };

						}

						log.debug('data', data);

						if (data != null) {
							//&& 0 < search.length
							_StockAvaliable.sort(compareSecondColumn);

							var InventoryDetailStatus = 'F';

							var Quantity_main = parseInt(item.quantity);

							for (var e = 0; e < _StockAvaliable.length; e++) {

								if (Quantity_main == _StockAvaliable[e][2]) {

									var inventoryDetailRec = OrderObj.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
									inventoryDetailRec.selectNewLine({
										sublistId: 'inventoryassignment'
									});

									inventoryDetailRec.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', text: _StockAvaliable[e][0] });
									inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: _StockAvaliable[e][2] });

									if (useInventorynumber) {
										inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', value: _StockAvaliable[e][3] });
									}

									inventoryDetailRec.commitLine({ sublistId: 'inventoryassignment' });
									OrderObj.commitLine({
										sublistId: 'item'
									});

									break;
								} else if (_StockAvaliable[e][2] < Quantity_main) {
									var inventoryDetailRec = OrderObj.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
									inventoryDetailRec.selectNewLine({
										sublistId: 'inventoryassignment'
									});

									inventoryDetailRec.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', text: _StockAvaliable[e][0] });
									inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: _StockAvaliable[e][2] });
									if (useInventorynumber) {
										inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', value: _StockAvaliable[e][3] });
									}

									inventoryDetailRec.commitLine({ sublistId: 'inventoryassignment' });

									Quantity_main = parseInt(Quantity_main - _StockAvaliable[e][2]);
									InventoryDetailStatus = 'T';

								} else if (_StockAvaliable[e][2] > Quantity_main) {

									if (InventoryDetailStatus == 'F') {

										var inventoryDetailRec = OrderObj.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
									}

									inventoryDetailRec.selectNewLine({
										sublistId: 'inventoryassignment'
									});

									inventoryDetailRec.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', text: _StockAvaliable[e][0] });

									inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: parseInt(Quantity_main) });

									if (useInventorynumber) {

										inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', value: _StockAvaliable[e][3] });
									}

									//inventoryDetailRec.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'status', text: "Good" , line:e});

									//A-01.001

									inventoryDetailRec.commitLine({ sublistId: 'inventoryassignment' });

									OrderObj.commitLine({
										sublistId: 'item'
									});

									break;

								}
							}
						}
						//-----------end of fefo

					} else {
						//this case for the item without any inventory detail it will commit without the fefo solution
						OrderObj.commitLine({
							sublistId: 'item'
						});
					}
				} catch (exxxx) {
					log.debug('error details are===========', 'Item Id ' + item.item_internal_id + exxxx.message, item);
					return { message: '--' + item.item_internal_id + '--' + item.quantity + '--', statusCode: 500, error: exxxx.message };
				}

			}; //end of items loop

			var OrderID = OrderObj.save({ enableSourcing: true, ignoreMandatoryFields: true });

			var lineIDs = [];

			var OrderObjNew = record.load({ type: 'invoice', id: OrderID, isDynamic: true });

			var itemCount = OrderObjNew.getLineCount({
				sublistId: 'item'
			});

			log.debug({
				title: 'Item Count',
				details: itemCount
			});

			for (var i = 0; i < itemCount; i++) {

				var lID = OrderObjNew.getSublistValue({
					sublistId: 'item',
					fieldId: 'lineuniquekey',
					line: i
				});

				lineIDs.push({
					'line_number': i,
					'open_cart_line_id': OrderObjNew.getSublistValue({ sublistId: 'item', fieldId: 'custcol_oc_sales_item_id', line: i }),
					'order_line_internal_id': lID
				});

			}

			log.debug('created order', { order_internal_id: OrderID });

			return { order_internal_id: OrderID, order_lines_internal_ids: lineIDs, message: 'Order Record is created Successfully!', statusCode: 200 };
		}

		function compareSecondColumn(a, b) {
			if (a[1] === b[1]) {
				return 0;
			} else {
				return a[1] < b[1] ? -1 : 1;
			}
		}

		// exported functions - restlet functions along with library functions
		return {
			post: createOrder
		};
	});
