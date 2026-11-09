/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * Script:      sl_po_coverage_validation.js
 *
 * GET  → renders HTML popup — only lines where costFlag OR covFlag ≠ Matching
 *         AND custcol_po_line_approved is not already true
 * POST → processes decisions via JSON fetch:
 *         - approved lines: stamps custcol_po_line_approved = true
 *         - rejected lines: removed from PO
 *         - all rejected: closes PO via isclosed per line
 *         - stamps custbody_po_approved_by with approver role name
 *         - auto-closes popup and reloads parent
 *
 * New custom fields needed:
 *   custcol_po_line_approved   – Checkbox (line level) – set true when line approved via popup
 *   custbody_po_approved_by    – Text (header) – stores approver role name after full approval
 */

define(['N/record', 'N/search', 'N/log'],
    (record, search, log) => {

        // ─────────────────────────────────────────────────────────────
        // CONSTANTS
        // ─────────────────────────────────────────────────────────────
        const LINE_COST_FLAG = 'custcol_po_cost_flag';
        const LINE_COV_FLAG = 'custcol_po_coverage_flag';
        const LINE_APPROVER_FLAG = 'custcol_po_approver_flag';
        const LINE_APPROVED = 'custcol_po_line_approved';   // NEW: checkbox per line
        const BODY_APPROVED_BY = 'custbody_po_approver_flag';

        // ─────────────────────────────────────────────────────────────
        // ENTRY POINT
        // ─────────────────────────────────────────────────────────────
        const onRequest = (context) => {
            if (context.request.method === 'GET') {
                handleGet(context);
            } else {
                handlePost(context);
            }
        };

        // ─────────────────────────────────────────────────────────────
        // GET – Render the approval popup HTML
        // ─────────────────────────────────────────────────────────────
        const handleGet = (context) => {
            const poId = context.request.parameters.poId;
            if (!poId) {
                context.response.write('<p style="color:red;">Missing PO ID.</p>');
                return;
            }

            const poRec = record.load({ type: record.Type.PURCHASE_ORDER, id: poId });
            const lines = collectLines(poRec);
            const poNumber = poRec.getValue('tranid') || poId;

            context.response.write(buildPopupHtml(poId, poNumber, lines));
        };

        // ─────────────────────────────────────────────────────────────
        // ROLE HIERARCHY – higher index = higher priority
        // ─────────────────────────────────────────────────────────────
        const ROLE_RANK = { 'CCO': 3, 'CED': 2, 'BUH': 1, 'Auto-Approve': 0 };

        const highestRole = (roleA, roleB) =>
            (ROLE_RANK[roleA] || 0) >= (ROLE_RANK[roleB] || 0) ? roleA : roleB;

        // Derive the next custbody_po_approver_flag value from remaining pending lines
        const deriveApproverFlag = (poRec, allFullyResolved) => {
            if (allFullyResolved) return null; // caller will set 'Approved by X'

            let topPendingRole = '';
            const lineCount = poRec.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                const itemType = poRec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
                if (itemType !== 'InvtPart') continue;
                const approved = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVED, line: i });
                if (isApproved(approved)) continue;  // skip already-approved lines
                const costFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COST_FLAG, line: i }) || 'Matching';
                const covFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COV_FLAG, line: i }) || 'Matching';
                if (costFlag === 'Matching' && covFlag === 'Matching') continue;
                const lineRole = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVER_FLAG, line: i }) || '';
                topPendingRole = highestRole(topPendingRole, lineRole);
            }
            return topPendingRole ? `Pending ${topPendingRole} approval` : null;
        };

        // ─────────────────────────────────────────────────────────────
        // POST – Process approve/reject decisions (called via fetch JSON)
        // ─────────────────────────────────────────────────────────────
        const handlePost = (context) => {
            let body;
            try {
                body = JSON.parse(context.request.body);
            } catch (e) {
                context.response.write(buildResultHtml(false, null, null, null, 'Invalid request body: ' + e.message));
                return;
            }

            const poId = body.poId;
            const decisions = body.decisions; // { lineIndex: 'approve' | 'reject' }

            try {
                const poRec = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: true });

                const toRemove = [];
                const toApprove = [];
                let actingRole = ''; // highest role among lines being decided in this submission

                Object.keys(decisions).forEach((idx) => {
                    const i = Number(idx);
                    const lineRole = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVER_FLAG, line: i }) || '';
                    actingRole = highestRole(actingRole, lineRole);
                    if (decisions[idx] === 'reject') toRemove.push(i);
                    else toApprove.push(i);
                });

                log.debug({
                    title: 'Approval POST',
                    details: `PO ${poId} | actingRole=${actingRole} | approve=${JSON.stringify(toApprove)} | reject=${JSON.stringify(toRemove)}`
                });

                // ── Stamp approved lines (before removal shifts indices) ──
                toApprove.forEach((i) => {
                    poRec.selectLine({ sublistId: 'item', line: i });
                    poRec.setCurrentSublistValue({ sublistId: 'item', fieldId: LINE_APPROVED, value: true });
                    poRec.commitLine({ sublistId: 'item' });
                });

                // ── Remove rejected lines descending ──────────────────
                toRemove.sort((a, b) => b - a);
                toRemove.forEach((i) => poRec.removeLine({ sublistId: 'item', line: i }));

                const remainingLines = poRec.getLineCount({ sublistId: 'item' });

                // ── All lines removed → close PO ──────────────────────
                if (remainingLines === 0) {
                    const poRecToClose = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: true });
                    const totalLines = poRecToClose.getLineCount({ sublistId: 'item' });
                    for (let i = 0; i < totalLines; i++) {
                        poRecToClose.selectLine({ sublistId: 'item', line: i });
                        poRecToClose.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true });
                        poRecToClose.commitLine({ sublistId: 'item' });
                    }
                    poRecToClose.save({ enableSourcing: false, ignoreMandatoryFields: true });
                    log.audit({ title: 'PO Closed', details: `PO ${poId} – all lines rejected and closed` });
                    context.response.write(buildResultHtml(true, poId, 0, 0, actingRole, true));
                    return;
                }

                // ── Check if any flagged unapproved lines remain ───────
                const stillPending = stillHasPendingLines(poRec);

                if (!stillPending) {
                    // All lines fully resolved → stamp 'Approved by X'
                    poRec.setValue({ fieldId: BODY_APPROVED_BY, value: `Approved by ${actingRole}` });
                } else {
                    // Some lines still pending → update flag to next highest pending role
                    const nextFlag = deriveApproverFlag(poRec, false);
                    if (nextFlag) poRec.setValue({ fieldId: BODY_APPROVED_BY, value: nextFlag });
                }

                poRec.save({ enableSourcing: false, ignoreMandatoryFields: true });

                // Build summary for result page
                const pendingCount = countPendingLines(poRec);
                context.response.write(buildResultHtml(true, poId, remainingLines, toApprove.length, actingRole, false, toRemove.length, pendingCount));

            } catch (e) {
                log.error({ title: 'Approval POST Error', details: e.toString() });
                context.response.write(buildResultHtml(false, poId, null, null, e.message, false, 0, 0));
            }
        };

        // ─────────────────────────────────────────────────────────────
        // Check if any flagged lines still need approval
        // ─────────────────────────────────────────────────────────────
        // isApproved: coerces custcol_po_line_approved regardless of boolean/string/'T'/'F'
        const isApproved = (val) => val === true || val === 'T' || val === 'true';

        const stillHasPendingLines = (poRec) => {
            const lineCount = poRec.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                const itemType = poRec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
                if (itemType !== 'InvtPart') continue;
                const costFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COST_FLAG, line: i }) || 'Matching';
                const covFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COV_FLAG, line: i }) || 'Matching';
                const approved = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVED, line: i });
                if ((costFlag !== 'Matching' || covFlag !== 'Matching') && !isApproved(approved)) return true;
            }
            return false;
        };

        // Count remaining unapproved flagged lines (for result message)
        const countPendingLines = (poRec) => {
            let count = 0;
            const lineCount = poRec.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                const itemType = poRec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
                if (itemType !== 'InvtPart') continue;
                const costFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COST_FLAG, line: i }) || 'Matching';
                const covFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COV_FLAG, line: i }) || 'Matching';
                const approved = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVED, line: i });
                if ((costFlag !== 'Matching' || covFlag !== 'Matching') && !isApproved(approved)) count++;
            }
            return count;
        };

        // ─────────────────────────────────────────────────────────────
        // Collect lines needing approval:
        //   - itemType = InvtPart
        //   - costFlag OR covFlag ≠ Matching
        //   - NOT already approved (custcol_po_line_approved ≠ true)
        // ─────────────────────────────────────────────────────────────
        const collectLines = (poRec) => {
            const lines = [];
            const lineCount = poRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const itemType = poRec.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });
                if (itemType !== 'InvtPart') continue;

                const costFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COST_FLAG, line: i }) || 'Matching';
                const covFlag = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_COV_FLAG, line: i }) || 'Matching';

                // Skip Matching lines
                if (costFlag === 'Matching' && covFlag === 'Matching') continue;

                // Skip already approved lines (coerce T/true/'T' all to boolean)
                const alreadyApproved = poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVED, line: i });
                if (isApproved(alreadyApproved)) continue;

                const itemInternalId = poRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                const itemData = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemInternalId,
                    columns: ['displayname', 'custitem_manufacturerlist', 'csegitem_category']
                });

                lines.push({
                    lineIndex: i,
                    itemId: itemInternalId,
                    itemName: poRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
                    displayName: itemData.displayname || '',
                    manfacturerBrand: itemData.custitem_manufacturerlist.length > 0 ? itemData.custitem_manufacturerlist[0].text : '',
                    itemCategory: itemData.csegitem_category.length > 0 ? itemData.csegitem_category[0].text : '',
                    quantity: poRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }),
                    rate: poRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }),
                    costFlag,
                    covFlag,
                    approver: poRec.getSublistValue({ sublistId: 'item', fieldId: LINE_APPROVER_FLAG, line: i }) || '—'
                });
            }
            return lines;
        };

        // ─────────────────────────────────────────────────────────────
        // FLAG HELPERS
        // ─────────────────────────────────────────────────────────────
        const flagColor = (flag) => {
            const map = {
                'Matching': '#27ae60',
                'Minor Variance': '#f1c40f',
                'Slight Excess': '#f1c40f',
                'Significant Variance': '#e67e22',
                'Moderate Excess': '#e67e22',
                'Critical Variance': '#e74c3c',
                'Critical Excess': '#e74c3c'
            };
            return map[flag] || '#95a5a6';
        };

        const flagBadge = (flag) =>
            `<span style="display:inline-block;padding:2px 8px;border-radius:10px;
                background:${flagColor(flag)};color:#fff;font-size:11px;font-weight:600;
                white-space:nowrap;">${flag}</span>`;

        // ─────────────────────────────────────────────────────────────
        // BUILD POPUP HTML
        // ─────────────────────────────────────────────────────────────
        const buildPopupHtml = (poId, poNumber, lines) => {

            if (lines.length === 0) {
                return `<!DOCTYPE html><html>
                <head><style>
                    body { font-family:Arial,sans-serif; display:flex; align-items:center;
                           justify-content:center; height:100vh; background:#f4f6f9; }
                    .card { background:#fff; border-radius:8px; padding:30px 40px;
                            box-shadow:0 2px 12px rgba(0,0,0,.1); text-align:center; }
                    .card p { font-size:14px; color:#2c3e50; margin-bottom:20px; }
                    .btn { padding:9px 24px; background:#1a3a5c; color:#fff; border:none;
                           border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; }
                </style></head>
                <body>
                    <div class="card">
                        <p>✅ All lines on PO <strong>${poNumber}</strong> are within coverage and cost targets.<br>No approval action required.</p>
                        <button class="btn" onclick="window.close()">Close</button>
                    </div>
                </body></html>`;
            }

            const rows = lines.map((l) => `
                <tr>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;">${l.itemName}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;">${l.displayName}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;">${l.manfacturerBrand}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;">${l.itemCategory}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${l.quantity}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${l.rate}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${flagBadge(l.costFlag)}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${flagBadge(l.covFlag)}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">
                        <input type="checkbox" id="approve_${l.lineIndex}"
                               onchange="handleCheck(${l.lineIndex},'approve')"
                               style="width:18px;height:18px;accent-color:#27ae60;cursor:pointer;">
                    </td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">
                        <input type="checkbox" id="reject_${l.lineIndex}"
                               onchange="handleCheck(${l.lineIndex},'reject')"
                               style="width:18px;height:18px;accent-color:#e74c3c;cursor:pointer;">
                    </td>
                </tr>`).join('');

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PO Approval – ${poNumber}</title>
    <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Arial,sans-serif; font-size:13px; background:#f4f6f9; color:#2c3e50; }
        .popup-header { background:#1a3a5c; color:#fff; padding:14px 20px;
            display:flex; align-items:center; justify-content:space-between; }
        .popup-header h2 { font-size:15px; font-weight:600; }
        .popup-body { padding:16px 20px; overflow-x:auto; }
        .info-bar { background:#eaf0fb; border-left:4px solid #2980b9;
            padding:8px 12px; margin-bottom:14px; border-radius:3px; font-size:12px; }
        table { width:100%; border-collapse:collapse; background:#fff;
            border-radius:6px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.08); }
        thead { background:#1a3a5c; color:#fff; }
        thead th { padding:10px; font-size:12px; font-weight:600; text-align:center; white-space:nowrap; }
        thead th:first-child { text-align:left; }
        tbody tr:hover { background:#f9fbff; }
        .col-approve { background:#27ae60; }
        .col-reject  { background:#e74c3c; }
        .footer { padding:12px 20px; display:flex; justify-content:flex-end; gap:10px;
            background:#fff; border-top:1px solid #e0e0e0; flex-wrap:wrap; }
        .btn { padding:8px 22px; border:none; border-radius:4px;
            font-size:13px; font-weight:600; cursor:pointer; transition:opacity .15s; }
        .btn:hover       { opacity:.85; }
        .btn-submit      { background:#1a3a5c; color:#fff; }
        .btn-cancel      { background:#bdc3c7; color:#2c3e50; }
        .btn-approve-all { background:#27ae60; color:#fff; }
        .btn-reject-all  { background:#e74c3c; color:#fff; }
        .validation-msg  { color:#e74c3c; font-size:12px; margin-bottom:8px; display:none; }
    </style>
</head>
<body>
    <div class="popup-header">
        <h2>&#9989; PO Line Approval – <span style="font-weight:400;">${poNumber}</span></h2>
        <span style="font-size:11px;opacity:.8;">Only lines requiring approval are shown</span>
    </div>

    <div class="popup-body">
        <div class="validation-msg" id="validationMsg">
            ⚠️ Please select either Approve or Reject for every line before submitting.
        </div>
        <div class="info-bar">
            Lines with <strong>Matching</strong> cost and coverage are automatically approved and not shown here.
            Approved lines are kept on the PO; rejected lines are removed.
            If all lines are rejected the PO will be <strong>Closed</strong>.
        </div>
        <table>
            <thead>
                <tr>
                    <th style="text-align:left;">Item</th>
                    <th>Display Name</th>
                    <th>Manufacturer/Brand</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Cost Status</th>
                    <th>Coverage Status</th>
                    <th class="col-approve">&#10003; Approve</th>
                    <th class="col-reject">&#10007; Reject</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>

    <div class="footer">
        <button type="button" class="btn btn-approve-all" onclick="selectAll('approve')">&#10003; Approve All</button>
        <button type="button" class="btn btn-reject-all"  onclick="selectAll('reject')">&#10007; Reject All</button>
        <button type="button" class="btn btn-cancel"      onclick="window.close()">Cancel</button>
        <button type="button" class="btn btn-submit"      id="btnSubmit" onclick="submitDecisions()">Submit Decisions</button>
    </div>

    <script>
        const LINE_INDICES = ${JSON.stringify(lines.map(l => l.lineIndex))};
        const PO_ID        = '${poId}';

        function selectAll(type) {
            LINE_INDICES.forEach(function(idx) {
                const a = document.getElementById('approve_' + idx);
                const r = document.getElementById('reject_'  + idx);
                if (type === 'approve') { if(a) a.checked=true;  if(r) r.checked=false; }
                else                   { if(r) r.checked=true;  if(a) a.checked=false; }
            });
        }

        function handleCheck(idx, type) {
            if (type === 'approve') { const r=document.getElementById('reject_' +idx); if(r) r.checked=false; }
            else                   { const a=document.getElementById('approve_'+idx); if(a) a.checked=false; }
        }

        function validateDecisions() {
            for (const idx of LINE_INDICES) {
                const a = document.getElementById('approve_' + idx);
                const r = document.getElementById('reject_'  + idx);
                if (!a.checked && !r.checked) return false;
            }
            return true;
        }

        function submitDecisions() {
            if (!validateDecisions()) {
                document.getElementById('validationMsg').style.display = 'block';
                return;
            }
            document.getElementById('validationMsg').style.display = 'none';

            const decisions = {};
            LINE_INDICES.forEach(function(idx) {
                decisions[idx] = document.getElementById('approve_' + idx).checked ? 'approve' : 'reject';
            });

            const btn = document.getElementById('btnSubmit');
            btn.disabled    = true;
            btn.textContent = 'Submitting...';

            fetch(window.location.href, {
                method : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({ poId: PO_ID, decisions: decisions })
            })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                document.open(); document.write(html); document.close();
            })
            .catch(function(err) {
                btn.disabled    = false;
                btn.textContent = 'Submit Decisions';
                alert('Submission error: ' + err.message);
            });
        }
    </script>
</body>
</html>`;
        };

        // ─────────────────────────────────────────────────────────────
        // BUILD RESULT HTML
        // Auto-closes popup after 2s and reloads parent window.
        // Shows a detailed summary of what happened this submission.
        // ─────────────────────────────────────────────────────────────
        const buildResultHtml = (success, poId, remainingLines, approvedCount, actingRole, allClosed, rejectedCount, pendingCount) => {
            if (!success) {
                return `<!DOCTYPE html><html><body style="font-family:Arial;padding:20px;">
                    <p style="color:red;">&#10060; Error: ${actingRole}</p>
                    <button onclick="window.close()" style="margin-top:12px;padding:6px 16px;">Close</button>
                </body></html>`;
            }

            // Build summary lines
            const summaryLines = [];

            if (allClosed) {
                summaryLines.push('🔒 All lines rejected — PO has been <strong>Closed</strong>.');
            } else {
                if (approvedCount > 0) {
                    summaryLines.push(
                        `✅ <strong>${approvedCount}</strong> line${approvedCount !== 1 ? 's' : ''} approved by <strong>${actingRole}</strong>.`
                    );
                }
                if (rejectedCount > 0) {
                    summaryLines.push(
                        `🗑️ <strong>${rejectedCount}</strong> line${rejectedCount !== 1 ? 's' : ''} rejected and removed from PO.`
                    );
                }
                if (pendingCount > 0) {
                    summaryLines.push(
                        `⏳ <strong>${pendingCount}</strong> line${pendingCount !== 1 ? 's' : ''} still pending decision.`
                    );
                }
            }

            const summaryHtml = summaryLines.map(s => `<p>${s}</p>`).join('');

            return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family:Arial,sans-serif; display:flex; align-items:center;
               justify-content:center; height:100vh; margin:0; background:#f4f6f9; }
        .card { background:#fff; border-radius:8px; padding:28px 36px;
                box-shadow:0 2px 12px rgba(0,0,0,.1); text-align:center; max-width:420px; }
        .card p { font-size:14px; color:#2c3e50; line-height:1.8; margin-bottom:6px; }
        .divider { border:none; border-top:1px solid #eee; margin:12px 0; }
        .spinner { width:22px; height:22px; border:3px solid #e0e0e0;
                   border-top-color:#1a3a5c; border-radius:50%;
                   animation:spin .7s linear infinite; margin:12px auto 6px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .closing { font-size:11px; color:#aaa; }
    </style>
</head>
<body>
    <div class="card">
        ${summaryHtml}
        <hr class="divider">
        <div class="spinner"></div>
        <p class="closing">Closing and refreshing PO in 2 seconds…</p>
    </div>
    <script>
        setTimeout(function() {
            try { if (window.opener && !window.opener.closed) window.opener.location.reload(); } catch(e) {}
            window.close();
        }, 2000);
    </script>
</body>
</html>`;
        };

        return { onRequest };
    });