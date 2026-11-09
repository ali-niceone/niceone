<?xml version="1.0"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>

    <head>
        <link name="NotoSans" type="font" subtype="truetype" src="${nsfont.NotoSansArabic_Regular}" src-bold="${nsfont.NotoSansArabic_Bold}"
            src-italic="${nsfont.NotoSansArabic_Italic}" src-bolditalic="${nsfont.NotoSansArabic_BoldItalic}" bytes="2" />
        <#if .locale=="zh_CN">
            <link name="NotoSansCJKsc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKsc_Regular}" src-bold="${nsfont.NotoSansCJKsc_Bold}" bytes="2" />
            <#elseif .locale=="zh_TW">
                <link name="NotoSansCJKtc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKtc_Regular}" src-bold="${nsfont.NotoSansCJKtc_Bold}" bytes="2" />
                <#elseif .locale=="ja_JP">
                    <link name="NotoSansCJKjp" type="font" subtype="opentype" src="${nsfont.NotoSansCJKjp_Regular}" src-bold="${nsfont.NotoSansCJKjp_Bold}" bytes="2" />
                    <#elseif .locale=="ko_KR">
                        <link name="NotoSansCJKkr" type="font" subtype="opentype" src="${nsfont.NotoSansCJKkr_Regular}" src-bold="${nsfont.NotoSansCJKkr_Bold}" bytes="2" />
                        <#elseif .locale=="th_TH">
                            <link name="NotoSansThai" type="font" subtype="opentype" src="${nsfont.NotoSansThai_Regular}" src-bold="${nsfont.NotoSansThai_Bold}" bytes="2" />
        </#if>
        <macrolist>
            <macro id="nlheader">
                <table width="100%">
                    <tr>
                        <td align="left" width="30%">Company Nice One Beauty Digital Marketing<br />
                            ${companyInformation.addressText}
                        </td>
                        <td align="center" width="30%"><strong>Purchase Requisition&nbsp;&nbsp;&nbsp;طلب شراء</strong></td>
                        <td align="right" width="40%"><img src="https://4952825.app.netsuite.com/core/media/media.nl?id=58162&amp;c=4952825&amp;h=XQ2c1UP-qfBNTUzx1E-W28H_2t3qqvWuxxNLls3DolQnMXHL" style="float: right; width: 150px; height: 50px;" /></td>
                    </tr>
                </table>
            </macro>
            <macro id="nlfooter">
                <table class="footer" style="width: 100%;">
                    <tr>
                        <td style="align: center;">This is a computer-generated document. No signature is required.
                            <div>
                                <pagenumber /> of
                                <totalpages />
                            </div>
                        </td>
                    </tr>
                </table>
            </macro>
        </macrolist>
        <style type="text/css">
        * {
            font-family: NotoSans, sans-serif;
            font-feature-settings: opentype;
        }

        table {
            font-size: 9pt;
            table-layout: auto;
        }

        .bb {
            border-bottom: 1px solid black;
            border-top: 1px solid black;
        }

        th {
            font-weight: bold;
            font-size: 8pt;
            vertical-align: middle;
            padding-right: 8px;
            padding-left: 8px;
            padding-bottom: 3px;
            padding-top: 5px;
            background-color: #00467F;
            color: #ffffff;
        }

        .pcenter p {
            text-align: center;
            display: table-cell;
        }

        .totalborders {
            border-top: 1px;
            border-top-color: solid black;
        }

        .totalbordersbottom {
            border-bottom: 1px solid black;
            border-bottom-color: solid black;
        }

        tdx {
            padding-right: 6px;
            padding-left: 6px;
            padding-bottom: 4px;
            padding-top: 4px;
        }

        b {
            font-weight: bold;
            color: #333333;
        }

        td p {
            align: left
        }

        b {
            font-weight: bold;
            color: #333333;
        }

        table.header td {
            padding: 0;
            font-size: 10pt;
        }

        table.footer td {
            padding: 0;
            font-size: 8pt;
        }

        table.itemtable th {
            padding-bottom: 2px;
            padding-top: 2px;
        }

        table.body td {
            padding-top: 2px;
        }

        table.total {
            page-break-inside: avoid;
        }

        tr.totalrow {
            background-color: #e3e3e3;
            line-height: 200%;
        }

        td.totalboxtop {
            font-size: 12pt;
            background-color: #e3e3e3;
        }

        td.addressheader {
            font-size: 8pt;
            padding-top: 6px;
            padding-bottom: 2px;
        }

        td.address {
            padding-top: 0;
        }

        td.totalboxmid {
            font-size: 28pt;
            padding-top: 20px;
            background-color: #e3e3e3;
        }

        span.title {
            font-size: 28pt;
        }

        span.number {
            font-size: 16pt;
        }

        span.itemname {
            font-weight: bold;
            line-height: 150%;
        }

        table.itemtable td {
            padding-bottom: 5px;
            padding-top: 5px;
        }

        hr {
            width: 100%;
            color: #d3d3d3;
            background-color: #d3d3d3;
            height: 1px;
        }

        .brclass {
            border-right: 1px black;
        }

        .britenclass {
            border-right: 1px black;
            border-bottom: 1px black;
        }

        .totalsection {
            border-left: 1px black;
            border-right: 1px black;
            border-bottom: 1px black;
        }

        .totalsectionvalues {
            border-right: 1px black;
            border-bottom: 1px black;
        }

        .itemheaderbreak {
            border-right: 1px black;
            border-right-color: black;
        }
        </style>
    </head>

    <body header="nlheader" header-height="12%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">
        <hr />
        <table align="left" style="table-layout: auto; width: 100%">
            <tr>
                <td style="text-align: left; background-color: #999999;" width="26%"><span style="font-size:10px;"><span style="color:#ffffff;"><strong>REQUESTOR INFO<br />معلومات البائع</strong></span></span></td>
                <td style="text-align: center; background-color: rgb(255, 255, 255);" width="2%"><span style="color:#ffffff;">&nbsp;</span></td>
                <th style="text-align: left;  background-color: rgb(255, 255, 255);" width="40%"><span style="font-size:10px;"><span style="color:#ffffff;"></span></span></th>
                <td style="text-align: center; background-color: rgb(255, 255, 255); width: 28px;" width="2%"><span style="color:#ffffff;">&nbsp;</span></td>
                <th style="text-align: left;  background-color: #999999;" width="30%"><span style="font-size:10px;"><span style="color:#ffffff;"><strong>PURCHASE REQUISITION INFO<br />معلومات طلب الشراء</strong></span></span></th>
            </tr>
        </table>
        <table align="left" style="table-layout: auto; width: 100%">
            <tr>
                <td style="font-size: 8px; width: 56px;" width="8%"><strong>Requestor Name</strong></td>
                <td style="font-size: 8px; width: 160px;" width="18%">
                    ${record.entity}
                </td>
                <td style="width: 14px;" width="2%">&nbsp;</td>
                <td style="font-size: 8px; width: 92px;" width="10%"></td>
                <td style="font-size: 8px; width: 220px;" width="30%"></td>
                <td style="width: 9px;" width="2%">&nbsp;</td>
                <td style="font-size: 8px; width: 124px;" width="10%"><strong>PR#</strong></td>
                <td style="font-size: 9px; width: 90px;" width="20%">
                    ${record.tranid}
                </td>
            </tr>
            <tr>
                <td style="font-size: 8px; width: 56px;" width="8%">&nbsp;</td>
                <td style="font-size: 8px; width: 160px;" width="18%">&nbsp;</td>
                <td style="width: 14px;">&nbsp;</td>
                <td style="font-size: 8px; width: 92px;"></td>
                <td style="font-size: 8px; width: 220px;"></td>
                <td style="width: 9px;"><br />&nbsp;</td>
                <td style="font-size: 8px; width: 124px;"><strong>Order Date</strong></td>
                <td style="font-size: 8px; width: 90px;">
                    ${record.trandate}
                </td>
            </tr>
            <tr>
                <td style="font-size: 8px; width: 56px;" width="8%">&nbsp;</td>
                <td style="font-size: 8px; width: 160px;" width="18%">&nbsp;</td>
                <td style="width: 14px;">&nbsp;</td>
                <td style="font-size: 8px; width: 92px;"></td>
                <td style="font-size: 8px; width: 220px;"></td>
                <td style="width: 9px;">&nbsp;</td>
                <td style="font-size: 8px; width: 124px;"><strong>Payment Terms</strong></td>
                <td style="font-size: 8px; width: 90px;">
                    ${record.terms}
                </td>
            </tr>
            <tr>
                <td style="width: 56px;">&nbsp;</td>
                <td style="width: 160px;">&nbsp;</td>
                <td style="width: 14px;">&nbsp;</td>
                <td style="font-size: 8px; width: 92px;"></td>
                <td colspan="1" rowspan="1" style="font-size: 8px; width: 220px;"></td>
                <td style="width: 9px;">&nbsp;</td>
                <td style="font-size: 8px; width: 124px;"><strong>Receive Date</strong></td>
                <td style="font-size: 8px; width: 90px;">
                    ${record.duedate}
                </td>
            </tr>
            <tr>
                <td style="width: 56px;">&nbsp;</td>
                <td style="width: 160px;">&nbsp;</td>
                <td style="width: 14px;">&nbsp;</td>
                <td style="font-size: 8px; width: 92px;">&nbsp;</td>
                <td colspan="1" rowspan="1" style="font-size: 8px; width: 220px;">&nbsp;</td>
                <td style="width: 9px;">&nbsp;</td>
                <td style="font-size: 8px; width: 124px;"><strong>Memo</strong></td>
                <td style="font-size: 8px; width: 90px;">
                    ${record.memo}
                </td>
            </tr>
        </table>
        <hr />
        <!-- Item table -->
        <#if record.item?has_content>
            <table style="width: 818.222px;" width="100%">
                <#list record.item as item>
                    <#if item_index==0>
                        <thead>
                            <tr>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 25px;" width="5%"><strong>#</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 66px;" width="10%"><strong>ITEM CODE<br />رمز الصنف</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 120px;" width="18%"><strong>BARCODE<br />الباركود</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 73px;" width="15%"><strong>DESCRIPTION<br />الوصف</strong></th>
                                <th class="itemheaderbreak" style="font-size: 10px; width: 67px;" width="8%"><strong>UNIT<br />الوحدة</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 49px;" width="8%"><strong>QTY.<br />الكمية</strong></th>
                                <!-- <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 49px;" width="11%">DISCOUNT</th> -->
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 54px;" width="15%"><strong>TOTAL AMOUNT</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 82px;" width="10%"><strong>IMAGE</strong></th>
                            </tr>
                        </thead>
                    </#if>
                    <tr>
                        <td style="font-size: 9px; width: 39px;">
                            ${item_index+1}
                        </td>
                        <td style="font-size: 9px; width: 80px;">
                            ${item.item}
                        </td>
                        <td style="font-size: 9px; width: 89px;">
                            ${item.custcol_no_barcode}
                        </td>
                        <td style="font-size: 9px; width: 87px;">
                            ${item.custcol_no_disp_nam_lin}
                        </td>
                        <td style="font-size: 9px; width: 81px;">
                            ${item.units}
                        </td>
                        <td style="font-size: 9px; width: 63px;">
                            ${item.quantity}
                        </td>
                        <!-- <td style="font-size: 9px; width: 86px;">
                            ${item.custcol6}
                        </td> -->
                        <td style="font-size: 9px; width: 68px;">
                            ${record.currency} ${item.amount}
                        </td>
                        <#assign x=item.quantity + item.quantity + 1>
                            <td style="font-size: 9px; width: 96px;">
                                <#if item.custcol11?length !=0><img height="45" src="${item.custcol11}" width="50" /></#if>
                            </td>
                    </tr>
                </#list>
            </table>
            <hr />
            <!--<table align="right" style="table-layout: auto; width: 40%">
                <tr>
                    <td class="totalborders" style="align: left; font-size:10px;"><strong>TOTAL PR ITEMS<br />حاصل المجموع</strong></td>
                    <td class="totalborders totalbordersright" style="align: left;; width: 110px; font-size:10px;"><strong>
                            ${record.custbody_insrt_po_item_count}
                        </strong></td>
                </tr>
                <tr>
                    <td class="totalborders" style="align: left; font-size:10px;"><strong>TOTAL ITEMS QUANTITY<br />حاصل المجموع</strong></td>
                    <td class="totalborders totalbordersright" style="align: left;; width: 110px; font-size:10px;"><strong>
                            ${record.custbody_insrt_po_qty}
                        </strong></td>
                </tr>
                <tr>
                    <td class="totalborders" style="align: left; font-size:10px;"><strong>SUBTOTAL<br />حاصل المجموع</strong></td>
                    <td class="totalborders totalbordersright" style="align: left;; width: 110px; font-size:10px;"><strong>
                            ${record.currency} ${record.subtotal}
                        </strong></td>
                </tr>
                <tr>
                    <td class="totalborders" style="align: left;;font-size:10px;">VAT 15% VALUE<br />15% مجموع الضريبة</td>
                    <td class="totalborders totalbordersright" style="align: left;; width: 110px;font-size:10px;">
                        ${record.currency} ${record.taxtotal}
                    </td>
                </tr>
                <tr>
                    <td class="totalborders totalbordersbottom" style="align: left;; font-size:10px;"><strong>NET TOTAL<br />صافي المجموع</strong></td>
                    <td class="totalborders totalbordersbottom totalbordersright" style="align: left;; width: 110px;font-size:10px;"><b>
                            ${record.currency} ${(record.total)}
                        </b></td>
                </tr>
            </table>-->
        </#if>
        <hr />
        <!-- Expense table -->
        <#if record.expense?has_content>
            <table style="width: 818.222px;" width="100%">
                <#list record.expense as expense>
                    <#if expense_index==0>
                        <thead>
                            <tr>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 25px;" width="5%"><strong>#</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 66px;" width="10%"><strong>CATEGORY<br />الصنف</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 120px;" width="18%"><strong>ACCOUNT<br />الحساب</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 73px;" width="15%"><strong>PO VENDOR<br />المورد</strong></th>
                                <th class="itemheaderbreak" style="font-size: 10px; width: 67px;" width="8%"><strong>LOCATION<br />الموقع</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 49px;" width="8%"><strong>MEMO<br />ملاحظة</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 49px;" width="11%">DEPARTMENT<br />القسم</th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); font-size: 10px; width: 54px;" width="15%"><strong>LINKED ORDER</strong></th>
                                <th class="itemheaderbreak" style="background-color: rgb(153, 153, 153); white-space: nowrap; font-size: 10px; width: 82px;" width="10%"><strong>AMOUNT</strong></th>
                            </tr>
                        </thead>
                    </#if>
                    <tr>
                        <td style="font-size: 9px; width: 39px;">
                            ${expense_index+1}
                        </td>
                        <td style="font-size: 9px; width: 80px;">
                            ${expense.category?replace("&", "&amp;")}
                        </td>
                        <td style="font-size: 9px; width: 89px;">
                            ${expense.account?replace("&", "&amp;")}
                        </td>
                        <td style="font-size: 9px; width: 87px;">
                            ${expense.povendor}
                        </td>
                        <td style="font-size: 9px; width: 81px;">
                            ${expense.location}
                        </td>
                        <td style="font-size: 9px; width: 63px;">
                            ${expense.memo}
                        </td>
                        <td style="font-size: 9px; width: 86px;">
                            ${expense.department}
                        </td>
                        <td style="font-size: 9px; width: 68px;">
                            ${expense.linkedorder}
                        </td>
                        <td style="font-size: 9px; width: 68px;">
                            ${record.currency} ${expense.amount}
                        </td>
                    </tr>
                </#list>
            </table>
            <hr />
            <!--<table align="right" style="table-layout: auto; width: 40%">
                <tr>
                    <td class="totalborders" style="align: left; font-size:10px;"><strong>ESTIMATED TOTAL<br />المجموع التقديري</strong></td>
                    <td class="totalborders totalbordersright" style="align: left;; width: 110px; font-size:10px;"><strong>
                            ${record.currency} ${record.estimatedtotal}
                        </strong></td>
                </tr>
                <tr>
                    <td class="totalborders totalbordersbottom" style="align: left;; font-size:10px;"><strong>TOTAL<br />المجموع</strong></td>
                    <td class="totalborders totalbordersbottom totalbordersright" style="align: left;; width: 110px;font-size:10px;"><b>
                            ${record.currency} ${(record.total)}
                        </b></td>
                </tr>
            </table>-->
        </#if>
        <!-- <hr />
        <table style="width: 703px;">
            <tr>
                <td style="text-align: left; width: 508px; font-size:10px;"><strong>&nbsp;</strong></td>
            </tr>
        </table>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>Notes:</strong><br />ملاحظات:<br />
                ${record.custbody_purchase_order_notes}
            </span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>السلام عليكم تحية طيبة وبعد</strong></span><br />&nbsp;</p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>مرفق لكم طلب أمر شراء من شركة نايس ون بيوتي للتسويق الالكتروني نرجو منكم توفيره وابلاغنا بالوقت المناسب للتسليم ليتم التنسيق مع المستودع وإرسال بطاقة موعد لكم ويرجي الالتزام بالاشتراطات التالية:</strong></span><br />&nbsp;</p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; يجب الالتزام بالسعر المعتمد في أمر الشراء كحد أقصى وفي حالة عدم التطابق سوف يتم خصم القيمة بأثر رجعي</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;لابد من إرسال صورة فاتورة الشراء قبل موعد الاستلام بيوم على الأقل لعمل مراجعة مبدئية.</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; الالتزام باشتراطات الهيئة السعودية للغذاء والدواء مثل الالتزام بدرجات الحرارة للمنتجات الواردة وأن تكون سيارة النقل مبردة (وجب التنويه بان إجراءات الاستلام يتم التحقق منها ومطابقه لاشتراطات الهيئة)</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>يجب الالتزام بمعايير الصحة والسلامة (ارتداء الكمامة - احضار تطبيق توكلنا مع السائق)</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; .يجب الالتزام بالكميات ويرجى ترتيب الأصناف في الفاتورة حسب ترتيب امر الشراء المرفق لتسهيل وتسريع عملية الاستلام</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; رص وترتيب المنتجات في كراتين ويجب وضع ملصق على كل كرتون يبين عدد الحبات ورقم الفاتورة </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; تاريخ الصلاحية لا يقل عن 12 شهر من تاريخ الاستلام وألا يقل عن 60% من الفترة الزمنية بين تاريخ التصنيع وتاريخ الانتهاء </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>في حالة وجود طلب مسبق لم يتم توريده برجاء إلغاؤه واعتماد الطلب الحالي </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; الرجاء تأكيد توريد الطلب خلال 24 ساعة من ارسال الايميل وفي حالة عدم التأكيد في الفترة المذكورة سيكون هذا إشعارا منكم بعدم توفر المنتجات لديكم</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>لابد من حجز موعد التسليم قبل 24 ساعة من التوريد على الأقل</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; سيتم حذف الطلب تلقائيا من النظام بعد 6 أيام في حال عدم توريده </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; في حالة التوريد الجزئي لأمر الشراء سوف يتم إقفال الطلب على النظام حسب الكميات الواردة بالفاتورة وعليه يجب إشعارنا بإنشاء أمر شراء جديد لاستكمال باقي الطلبية</strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; في حالة تغيير صورة المنتج أو الباركود الدولي عن الوارد في أمر الشراء برجاء التواصل مسبقا قبل الاستلام تجنبا لإرجاع المنتج من فريق العمليات </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; يجب أن تكون البضاعة موضوعة على طبالي لتسهيل عملية الإنزال من السيارة </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; سيتم إلغاء أمر الشراء في حال عدم الإلتزام بالموعد المحدد </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; يجب إحضار أصل الفاتورة موضح بها بيانات الشركة والرقم الضريبي والباركود حتى لا يتم الرفض </strong></span></p>
        <p style="align: right; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull; .يرجى التسليم من خلال سند تسليم وعلى أساسه يتم عمل الفاتورة النهائية تلافيا لعمل مرتجعات </strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>Greetings,</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>We have sent a purchase order request from Compnay Nice One Beauty Digital Marketing, and we would like to confirm the delivery time with you so that we can coordinate with the warehouse and send you an appointment card. Please note that the following requirements must be adhered to:</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;The price approved in the purchase order must be adhered to as a maximum, and in the event of non-compliance, the value will be deducted retroactively.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;A copy of the purchase invoice must be sent at least one day before the receipt date for an initial review.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Adherence to the requirements of the SFDA, such as adhering to the temperatures of incoming products and that the transport vehicle must be refrigerated (it must be noted that the receipt procedures are verified and comply with the SFDA requirements).</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Health and safety standards must be adhered to.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Quantities must be adhered to and please arrange the items in the invoice according to the sequence of the attached purchase order to facilitate and speed up the receipt process.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Stack and arrange the products into cartons, and a label must be placed on each carton indicating the number of units and the invoice number.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;The expiration date is not less than 12 months from the date of receipt and is not less than 60% of the period between the manufacturing date and the expiry date.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;If there is a prior order that was not supplied, please cancel it and approve the current order.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Please confirm the supply of the order within 24 hours of sending this email. If you do not confirm within this period, this will be a notification to you that you do not have the products available.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;Delivery time must be booked at least 24 hours before delivery.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;The order will be automatically deleted from our system after 6 days if it is not supplied.</strong></span></p>
        <p style="align: left; font-size:9px;"><br /><span style="font-size:10px;"><strong>&bull;In case of partial supply of the purchase order, it will be closed on our system accordingly.</strong></span></p> -->
    </body>
</pdf>