/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * Script:      sl_po_rate_change_review.js
 * Description: Raw-HTML popup for PO rate change review.
 *
 * GET  → renders HTML popup table of pending rate-increase lines
 * POST → reads JSON body from fetch(), processes approve/reject, saves PO, auto-closes popup
 */

define(['N/record', 'N/search', 'N/cache', 'N/log'],
    function (record, search, cache, log) {

        const STATUS = { PENDING: 1, APPROVED: 2, REJECTED: 3 };
        const CHUNK = 500;

        // ─────────────────────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────────────────────
        function chunkArray(arr, size) {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        }

        function fetchPurchasePrices(itemIdArray) {
            const map = {};
            if (!itemIdArray || itemIdArray.length === 0) return map;
            chunkArray(itemIdArray, CHUNK).forEach(function (ids) {
                search.create({
                    type: search.Type.ITEM,
                    filters: [['internalid', 'anyof', ids]],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'cost' })
                    ]
                }).run().each(function (r) {
                    const id = r.getValue({ name: 'internalid' });
                    const price = r.getValue({ name: 'cost' });
                    map[String(id)] = (price === '' || price === null) ? 0 : Number(price);
                    return true;
                });
            });
            return map;
        }

        function fmt(num) {
            return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function deltaPct(purchasePrice, proposed) {
            if (purchasePrice === 0) return proposed === 0 ? '0%' : '+100%';
            const pct = ((proposed - purchasePrice) / purchasePrice) * 100;
            return (pct >= 0 ? '+' : '') + Math.round(pct) + '%';
        }

        function costFlagLabel(purchasePrice, proposed) {
            if (!purchasePrice || purchasePrice === 0) return 'Matching';
            const pct = (proposed / purchasePrice) * 100;
            if (pct <= 100) return 'Matching';
            if (pct <= 115) return 'Minor Variance';
            if (pct <= 130) return 'Significant Variance';
            return 'Critical Variance';
        }

        function flagColor(flag) {
            const map = {
                'Matching': '#27ae60',
                'Minor Variance': '#f1c40f',
                'Significant Variance': '#e67e22',
                'Critical Variance': '#e74c3c'
            };
            return map[flag] || '#95a5a6';
        }

        function flagBadge(flag) {
            return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;' +
                'background:' + flagColor(flag) + ';color:#fff;font-size:11px;font-weight:600;' +
                'white-space:nowrap;">' + flag + '</span>';
        }

        // ─────────────────────────────────────────────────────────────
        // ENTRY POINT
        // ─────────────────────────────────────────────────────────────
        function onRequest(ctx) {
            const req = ctx.request;
            const res = ctx.response;

            try {
                const poId = Number(req.parameters.poid) || Number(req.parameters.custpage_poid);
                if (!poId) { res.write('<p style="color:red;">Missing poid.</p>'); return; }

                const paramType = req.parameters.paramtype || req.parameters.custpage_paramtype;
                if (!paramType) { res.write('<p style="color:red;">Missing paramtype.</p>'); return; }

                if (req.method === 'GET') {
                    handleGet(ctx, poId, paramType);
                } else {
                    handlePost(ctx, poId, paramType);
                }
            } catch (e) {
                log.error({ title: 'sl_po_rate_change_review.onRequest', details: e.toString() });
                ctx.response.write(buildErrorHtml(e.message));
            }
        }

        // ─────────────────────────────────────────────────────────────
        // GET – Collect pending lines and render HTML popup
        // ─────────────────────────────────────────────────────────────
        function handleGet(ctx, poId, paramType) {
            const po = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });
            const poNumber = po.getValue({ fieldId: 'tranid' }) || String(poId);
            const lines = collectCandidateLines(po);
            ctx.response.write(buildPopupHtml(poId, poNumber, paramType, lines));
        }

        function collectCandidateLines(po) {
            const lineCount = po.getLineCount({ sublistId: 'item' });
            const candidates = [];
            const itemIdSet = new Set();

            for (let i = 0; i < lineCount; i++) {
                const st = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: i })) || 0;
                if (st !== STATUS.PENDING) continue;
                const itemId = po.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const itemData = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['displayname', 'custitem_manufacturerlist', 'csegitem_category']
                });
                candidates.push({
                    poLine: i,
                    itemId: String(itemId),
                    itemText: po.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }) || String(itemId),
                    displayName: itemData.displayname || '',
                    manfacturerBrand: itemData.custitem_manufacturerlist.length > 0 ? itemData.custitem_manufacturerlist[0].text : '',
                    itemCategory: itemData.csegitem_category.length > 0 ? itemData.csegitem_category[0].text : '',
                    proposed: Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_proposed_rate', line: i })) || 0,
                    qty: po.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 0
                });
                if (itemId) itemIdSet.add(String(itemId));
            }

            const priceMap = fetchPurchasePrices(Array.from(itemIdSet));

            return candidates.reduce(function (acc, l) {
                const purchasePrice = Number(priceMap[l.itemId] || 0);
                if (!(purchasePrice < l.proposed)) return acc;
                acc.push({
                    poLine: l.poLine,
                    itemId: l.itemId,
                    itemText: l.itemText,
                    displayName: l.displayName,
                    manfacturerBrand: l.manfacturerBrand,
                    itemCategory: l.itemCategory,
                    qty: l.qty,
                    purchasePrice: purchasePrice,
                    proposed: l.proposed,
                    deltaPct: deltaPct(purchasePrice, l.proposed),
                    costFlag: costFlagLabel(purchasePrice, l.proposed)
                });
                return acc;
            }, []);
        }

        // ─────────────────────────────────────────────────────────────
        // BUILD POPUP HTML — no <form>, uses fetch() for POST
        // ─────────────────────────────────────────────────────────────
        function buildPopupHtml(poId, poNumber, paramType, lines) {

            if (lines.length === 0) {
                return '<!DOCTYPE html><html><head><style>' +
                    'body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f4f6f9;}' +
                    '.card{background:#fff;border-radius:8px;padding:30px 40px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;}' +
                    '.card p{font-size:14px;color:#2c3e50;margin-bottom:20px;}' +
                    '.btn{padding:9px 24px;background:#1a3a5c;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;}' +
                    '</style></head><body><div class="card">' +
                    '<p>&#10003; No pending rate increases on PO <strong>' + poNumber + '</strong>.</p>' +
                    '<button class="btn" onclick="window.close()">Close</button>' +
                    '</div></body></html>';
            }

            const rows = lines.map(function (l) {
                return '<tr>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;">' + l.itemText + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;">' + l.displayName + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;">' + l.manfacturerBrand + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;">' + l.itemCategory + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">' + l.qty + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">' + fmt(l.purchasePrice) + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">' + fmt(l.proposed) + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">' +
                    '<span style="font-weight:600;color:' + (l.deltaPct.startsWith('+') ? '#e74c3c' : '#27ae60') + ';">' + l.deltaPct + '</span>' +
                    '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">' + flagBadge(l.costFlag) + '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">' +
                    '<input type="checkbox" id="approve_' + l.poLine + '" onchange="handleCheck(' + l.poLine + ',\'approve\')" ' +
                    'style="width:18px;height:18px;accent-color:#27ae60;cursor:pointer;">' +
                    '</td>' +
                    '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">' +
                    '<input type="checkbox" id="reject_' + l.poLine + '" onchange="handleCheck(' + l.poLine + ',\'reject\')" ' +
                    'style="width:18px;height:18px;accent-color:#e74c3c;cursor:pointer;">' +
                    '</td>' +
                    '</tr>';
            }).join('');

            const lineIndicesJson = JSON.stringify(lines.map(function (l) { return l.poLine; }));

            return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
                '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
                '<title>Rate Change Review \u2013 ' + poNumber + '</title>\n' +
                '<style>\n' +
                '* { box-sizing:border-box; margin:0; padding:0; }\n' +
                'body { font-family:Arial,sans-serif; font-size:13px; background:#f4f6f9; color:#2c3e50; }\n' +
                '.popup-header { background:#1a3a5c; color:#fff; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; }\n' +
                '.popup-header h2 { font-size:15px; font-weight:600; }\n' +
                '.popup-body { padding:16px 20px; overflow-x:auto; }\n' +
                '.info-bar { background:#fef9e7; border-left:4px solid #f39c12; padding:8px 12px; margin-bottom:14px; border-radius:3px; font-size:12px; }\n' +
                'table { width:100%; border-collapse:collapse; background:#fff; border-radius:6px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.08); }\n' +
                'thead { background:#1a3a5c; color:#fff; }\n' +
                'thead th { padding:10px; font-size:12px; font-weight:600; text-align:center; white-space:nowrap; }\n' +
                'thead th:first-child { text-align:left; }\n' +
                'tbody tr:hover { background:#f9fbff; }\n' +
                '.col-approve { background:#27ae60; } .col-reject { background:#e74c3c; }\n' +
                '.footer { padding:12px 20px; display:flex; justify-content:flex-end; gap:10px; background:#fff; border-top:1px solid #e0e0e0; flex-wrap:wrap; }\n' +
                '.btn { padding:8px 22px; border:none; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; transition:opacity .15s; }\n' +
                '.btn:hover { opacity:.85; } .btn-submit { background:#1a3a5c; color:#fff; }\n' +
                '.btn-cancel { background:#bdc3c7; color:#2c3e50; } .btn-approve-all { background:#27ae60; color:#fff; } .btn-reject-all { background:#e74c3c; color:#fff; }\n' +
                '.validation-msg { color:#e74c3c; font-size:12px; margin-bottom:8px; display:none; }\n' +
                '</style>\n</head>\n<body>\n' +
                '<div class="popup-header">\n' +
                '  <h2>&#9888; Rate Change Review \u2013 <span style="font-weight:400;">' + poNumber + '</span></h2>\n' +
                '  <span style="font-size:11px;opacity:.8;">' + lines.length + ' line(s) pending approval</span>\n' +
                '</div>\n' +
                '<div class="popup-body">\n' +
                '  <div class="validation-msg" id="validationMsg">&#9888;&#65039; Please select either Approve or Reject for every line before submitting.</div>\n' +
                '  <div class="info-bar">&#9888;&#65039; Lines below have a proposed rate <strong>higher</strong> than the item\'s last purchase price. ' +
                '<strong>Approve</strong> to accept the new rate \u2014 <strong>Reject</strong> to remove the line from the PO. ' +
                'If all lines are rejected the PO will be <strong>Closed</strong>.</div>\n' +
                '  <table><thead><tr>\n' +
                '    <th style="text-align:left;">Item</th><th>Display Name</th><th>Manufacturer/Brand</th><th>Category</th>' +
                '<th>Qty</th><th>Last Purchase Price</th><th>Proposed Rate</th><th>Delta</th><th>Cost Flag</th>' +
                '<th class="col-approve">&#10003; Approve</th><th class="col-reject">&#10007; Reject</th>\n' +
                '  </tr></thead><tbody>' + rows + '</tbody></table>\n' +
                '</div>\n' +
                '<div class="footer">\n' +
                '  <button type="button" class="btn btn-approve-all" onclick="selectAll(\'approve\')">&#10003; Approve All</button>\n' +
                '  <button type="button" class="btn btn-reject-all"  onclick="selectAll(\'reject\')">&#10007; Reject All</button>\n' +
                '  <button type="button" class="btn btn-cancel"      onclick="window.close()">Cancel</button>\n' +
                '  <button type="button" class="btn btn-submit" id="btnSubmit" onclick="submitDecisions()">Submit Decisions</button>\n' +
                '</div>\n' +
                '<script>\n' +
                'var LINE_INDICES = ' + lineIndicesJson + ';\n' +
                'var PO_ID        = "' + poId + '";\n' +
                'var PARAM_TYPE   = "' + paramType + '";\n' +
                'function selectAll(type) {\n' +
                '    LINE_INDICES.forEach(function(idx) {\n' +
                '        var a = document.getElementById("approve_" + idx);\n' +
                '        var r = document.getElementById("reject_"  + idx);\n' +
                '        if (type === "approve") { if(a) a.checked=true;  if(r) r.checked=false; }\n' +
                '        else                   { if(r) r.checked=true;  if(a) a.checked=false; }\n' +
                '    });\n}\n' +
                'function handleCheck(idx, type) {\n' +
                '    if (type === "approve") { var r=document.getElementById("reject_" +idx); if(r) r.checked=false; }\n' +
                '    else                   { var a=document.getElementById("approve_"+idx); if(a) a.checked=false; }\n}\n' +
                'function validateDecisions() {\n' +
                '    for (var i=0; i<LINE_INDICES.length; i++) {\n' +
                '        var a=document.getElementById("approve_"+LINE_INDICES[i]);\n' +
                '        var r=document.getElementById("reject_" +LINE_INDICES[i]);\n' +
                '        if (!a.checked && !r.checked) return false;\n' +
                '    }\n    return true;\n}\n' +
                'function submitDecisions() {\n' +
                '    if (!validateDecisions()) { document.getElementById("validationMsg").style.display="block"; return; }\n' +
                '    document.getElementById("validationMsg").style.display = "none";\n' +
                '    var decisions = {};\n' +
                '    LINE_INDICES.forEach(function(idx) {\n' +
                '        decisions[idx] = document.getElementById("approve_"+idx).checked ? "approve" : "reject";\n' +
                '    });\n' +
                '    var btn = document.getElementById("btnSubmit");\n' +
                '    btn.disabled = true; btn.textContent = "Submitting...";\n' +
                '    fetch(window.location.href, {\n' +
                '        method:"POST", headers:{"Content-Type":"application/json"},\n' +
                '        body: JSON.stringify({ poid: PO_ID, paramtype: PARAM_TYPE, decisions: decisions })\n' +
                '    })\n' +
                '    .then(function(res){ return res.text(); })\n' +
                '    .then(function(html){ document.open(); document.write(html); document.close(); })\n' +
                '    .catch(function(err){ btn.disabled=false; btn.textContent="Submit Decisions"; alert("Submission error: "+err.message); });\n' +
                '}\n' +
                '<\/script>\n</body>\n</html>';
        }

        // ─────────────────────────────────────────────────────────────
        // POST – Read JSON body, process decisions, save PO
        // ─────────────────────────────────────────────────────────────
        function handlePost(ctx, poId, paramType) {
            const req = ctx.request;
            const res = ctx.response;

            if (paramType !== 'ratechange') { res.write('Invalid paramtype'); return; }

            try {
                // Parse JSON body sent by fetch()
                let body;
                try {
                    body = JSON.parse(req.body);
                } catch (e) {
                    res.write(buildErrorHtml('Invalid request body: ' + e.message));
                    return;
                }

                const decisions = body.decisions || {}; // { poLine: 'approve' | 'reject' }
                const approveIdx = [];
                const rejectIdx = [];

                Object.keys(decisions).forEach(function (idx) {
                    const i = Number(idx);
                    if (decisions[idx] === 'approve') approveIdx.push(i);
                    else rejectIdx.push(i);
                });

                log.debug({ title: 'Rate Change POST', details: 'PO ' + poId + ' | approve=' + JSON.stringify(approveIdx) + ' | reject=' + JSON.stringify(rejectIdx) });

                if (approveIdx.length === 0 && rejectIdx.length === 0) {
                    res.write(buildErrorHtml('No decisions were submitted.'));
                    return;
                }

                const po = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });

                // Build priceMap for all involved lines
                const itemIdSet = new Set();
                approveIdx.concat(rejectIdx).forEach(function (idx) {
                    const itemId = po.getSublistValue({ sublistId: 'item', fieldId: 'item', line: idx });
                    if (itemId) itemIdSet.add(String(itemId));
                });
                const priceMap = fetchPurchasePrices(Array.from(itemIdSet));

                let approvedCount = 0, rejectedCount = 0;

                // ── Approve: set rate to proposed rate ────────────────
                approveIdx.forEach(function (idx) {
                    const st = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: idx })) || 0;
                    if (st !== STATUS.PENDING) return;
                    const propRaw = po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_proposed_rate', line: idx });
                    const prop = (propRaw === '' || propRaw == null) ? null : Number(propRaw);
                    if (prop == null || isNaN(prop)) return;
                    const itemId = po.getSublistValue({ sublistId: 'item', fieldId: 'item', line: idx });
                    const masterPrice = Number(priceMap[String(itemId)] || 0);
                    if (!(masterPrice < prop)) return;
                    po.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: idx, value: prop });
                    po.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: idx, value: STATUS.APPROVED });
                    po.setSublistValue({ sublistId: 'item', fieldId: 'custcol_proposed_rate', line: idx, value: prop });
                    approvedCount++;
                });

                // ── Reject ─────────────────────────────────────────────
                const totalPoLines = po.getLineCount({ sublistId: 'item' });

                if (totalPoLines === 1 && rejectIdx.indexOf(0) !== -1) {
                    const st = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: 0 })) || 0;
                    if (st === STATUS.PENDING) {
                        const itemId = po.getSublistValue({ sublistId: 'item', fieldId: 'item', line: 0 });
                        const masterPrice = Number(priceMap[String(itemId)] || 0);
                        const prop = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_proposed_rate', line: 0 }) || 0);
                        if (masterPrice < prop) {
                            try {
                                po.setSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: 0, value: true });
                            } catch (e) {
                                po.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: 0, value: 0 });
                                try { po.setSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: 0, value: true }); } catch (e2) { }
                            }
                            po.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: 0, value: STATUS.REJECTED });
                            rejectedCount++;
                        }
                    }
                } else {
                    const uniqueDesc = rejectIdx.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return b - a; });
                    uniqueDesc.forEach(function (idx) {
                        const st = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: idx })) || 0;
                        if (st !== STATUS.PENDING) return;
                        const itemId = po.getSublistValue({ sublistId: 'item', fieldId: 'item', line: idx });
                        const masterPrice = Number(priceMap[String(itemId)] || 0);
                        const prop = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_proposed_rate', line: idx }) || 0);
                        if (!(masterPrice < prop)) return;
                        po.removeLine({ sublistId: 'item', line: idx });
                        rejectedCount++;
                    });
                }

                // ── Update hasPending flag ─────────────────────────────
                let stillPending = false;
                const finalCount = po.getLineCount({ sublistId: 'item' });
                for (let i = 0; i < finalCount; i++) {
                    const st = Number(po.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ratechg_status', line: i })) || 0;
                    if (st === STATUS.PENDING) { stillPending = true; break; }
                }
                po.setValue({ fieldId: 'custbody_has_pending_ratechg', value: stillPending });

                // ── Bypass cache so UE beforeSubmit skips re-processing ─
                const c = cache.getCache({ name: 'ratechg_bypass', scope: cache.Scope.PRIVATE });
                c.put({ key: 'BYPASS_RATECHG_' + poId, value: 'T', ttl: 300 });

                po.save({ enableSourcing: false, ignoreMandatoryFields: true });

                if ((approvedCount + rejectedCount) > 0) {
                    ctx.response.write(buildResultHtml(approvedCount, rejectedCount, stillPending));
                    return;
                }

                res.write(buildErrorHtml('No updates were applied.'));

            } catch (e) {
                log.error({ title: 'Rate Change POST Error', details: e.toString() });
                ctx.response.write(buildErrorHtml(e.message));
            }
        }

        // ─────────────────────────────────────────────────────────────
        // RESULT HTML – auto-closes popup and reloads parent after 2s
        // ─────────────────────────────────────────────────────────────
        function buildResultHtml(approvedCount, rejectedCount, stillPending) {
            const lines = [];
            if (approvedCount > 0) lines.push('&#10003; <strong>' + approvedCount + '</strong> line' + (approvedCount !== 1 ? 's' : '') + ' approved — rate updated.');
            if (rejectedCount > 0) lines.push('&#128465; <strong>' + rejectedCount + '</strong> line' + (rejectedCount !== 1 ? 's' : '') + ' rejected and removed from PO.');
            if (stillPending) lines.push('&#9203; Additional pending rate changes remain on this PO.');

            const summaryHtml = lines.map(function (l) { return '<p>' + l + '</p>'; }).join('');

            return '<!DOCTYPE html><html><head><style>' +
                'body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f6f9;}' +
                '.card{background:#fff;border-radius:8px;padding:28px 36px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;max-width:420px;}' +
                '.card p{font-size:14px;color:#2c3e50;line-height:1.8;margin-bottom:6px;}' +
                '.divider{border:none;border-top:1px solid #eee;margin:12px 0;}' +
                '.spinner{width:22px;height:22px;border:3px solid #e0e0e0;border-top-color:#1a3a5c;border-radius:50%;animation:spin .7s linear infinite;margin:12px auto 6px;}' +
                '@keyframes spin{to{transform:rotate(360deg);}}' +
                '.closing{font-size:11px;color:#aaa;}' +
                '</style></head><body>' +
                '<div class="card">' + summaryHtml +
                '<hr class="divider"><div class="spinner"></div>' +
                '<p class="closing">Closing and refreshing PO in 2 seconds\u2026</p>' +
                '</div>' +
                '<script>setTimeout(function(){try{if(window.opener&&!window.opener.closed)window.opener.location.reload();}catch(e){}window.close();},2000);<\/script>' +
                '</body></html>';
        }

        function buildErrorHtml(msg) {
            return '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px;">' +
                '<p style="color:red;">&#10060; Error: ' + msg + '</p>' +
                '<button onclick="window.close()" style="margin-top:12px;padding:6px 16px;">Close</button>' +
                '</body></html>';
        }

        return { onRequest: onRequest };
    });