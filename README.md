# WhatsApp Desk

One WhatsApp Business number, a small team, and automatic routing by organization.

* A customer messages your number and gets a tap-to-choose menu.
* If they say which organization they are from ("I'm from Hilton"), the chat goes to the person who handles that organization (main person, then backup, then the least busy member).
* Customers can send an Order ID (or just ask "track my order") and the bot answers from your Excel sheet.
* Your team answers from a shared inbox with live updates, hand-over, and resolve/reopen.

Runs on **Node.js 20 or newer**. The desk itself needs no packages. Three small ones (`npm install`) are used only for linking your phone number with a QR code, and **ffmpeg** turns recorded voice messages into WhatsApp voice notes. The Docker image installs all of them for you.

## v101: v90 merged into v100, WooCommerce connection fixes, admin-approved order messages

* **Merged.** v100 plus everything from v90: **Store**, **Social posting** and **Product analytics** are back in the left menu (they were missing from v100's menu). The auto-AI posting and the second WhatsApp **Posting number** (Status + Channel posts only) were already in both builds and are unchanged.
* **WordPress connection.** The desk now finds a working way in by itself and remembers it: Authorization header or `consumer_key` in the address (hosts that strip the header), `/wp-json/` or `?rest_route=` (Permalinks set to Plain), and it follows http → https / www redirects. Errors say what is wrong (wrong key, key without permission, firewall / Cloudflare block, SSL certificate, address not found, login page returned). Order sync now looks back 26 hours so a time-zone difference between WordPress and the desk can never skip a changed order.
* **Order messages (Store → Order messages).** New order (PDF), *Completed*, *Cancelled*, *Refunded*, *Payment failed*, *On hold*, *Processing* and *Tracking number added* each prepare a WhatsApp message with the order details. **Nothing is sent until the administrator presses Approve**: edit the text, attach the PDF or not, Approve / Reject (or Approve all). The number of waiting messages shows on the Store menu button. You choose which events make a message and edit the wording ({name} {number} {total} {items} {courier} {cn} {track} {address} …). Failed sends stay in the list with **Retry**. The old *send PDF automatically* now goes through the same approval; untick *Administrator must approve* to send by themselves. For cancellations to arrive at once add a WooCommerce webhook with topic **Order updated** (same URL and secret); otherwise they arrive with the next sync. Server: `GET /api/woo/outbox`, `POST /api/woo/outbox/approve | approve-all | reject` (administrator only).

## v97: Daily report DC alerts first, each DC counted once, numbers open the filtered Company report

* The **DC alerts** section is the first section of the Daily report. **Pending past the limit** now counts every DC once (two people alerted about the same DCs no longer double it).
* Click that number, or a person's *Overdue DCs*, or a company's *Pending DCs*: Company report opens already filtered (company + Pending dispatch + DC date up to the limit).

## v96: parcels, alert mute / time, alert in the Daily report, Gmail colours

* **Edit DC → Parcels dispatched**: type how many parcels left. It is saved in the Excel sheet when the sheet has a *Parcels / No of parcels / Packages / Cartons / Boxes* column, otherwise in the app (and kept after every sync). Shown as the **Parcels** column of the DC list (Columns menu, PDF, Excel, Edit columns) and as **Parcels dispatched: N** (DCs that left) at the top of the Company report / Overview.
* **DC alert: Mute and Alert time** (every person who gets the alert, on the card and on the bar at the top of Company report): mute for 1 hour / 4 hours / until tomorrow 8:00 / until turned on; show *whenever overdue*, *again every N minutes / hours*, or *only at chosen times of the day*. Saved on the server per person. While muted the number on Company report stays, so nothing is hidden.
* **Daily report → DC alerts (pending dispatch)**: who is alerted (companies, days, on / paused, when it shows) and the overdue DCs per person and company, right now. Tick it in the Daily report sections (existing installs get it ticked once).
* **Mail editor**: the colour button is now Gmail's: one pop-up with **Background color** and **Text color** palettes.

## DC pending alerts (v95)

The administrator chooses who is warned about DCs that are **still Pending dispatch after N days**.

* **Settings → DC pending alerts → Add a person**: pick the person, tick the companies (or *All companies*) and the number of days (counted from the DC date / order date; 1 = anything older than today). *On* pauses an alert, *Remove* deletes it. Press **Save alerts**.
* That person gets an **alert card** (company by company, with the count and the oldest DC date), a **number on Company report** and a **desktop pop-up** (if notifications are turned on). It refreshes every 5 minutes, when the page is opened again, and after the administrator saves.
* **Clicking** a company (or *Show all*) opens **Company report already filtered**: that company + Pending dispatch + DC date up to the limit. Dispatched, self, cancelled and today's DCs are not counted; DCs without a date are left out.
* The person can open the companies the administrator gave them even when another person looks after those companies. Server: `GET /api/dcalerts` (own alert), `GET / PUT /api/dcalerts/config` (administrator). Stored in `db.dcAlerts`.

## PDF preview: exact selection, Chrome print, tidy header (v94)

* **Selecting text in a PDF** now follows the mouse by position (`public/pdfsel.js`). Dragging over blank paper no longer highlights everything above / below: only what you drag over is selected. Double-click = word, triple-click = line, **Ctrl+A** = the whole file, click on empty paper = clear.
* **Print** (printer button in the PDF preview) opens **Chrome's own print preview** (Destination / Pages / Copies / More settings), like Gmail, instead of the old Windows printer box. The sheet is the file's own size with no margins, so the printout is the file itself.
* The red file-type badge, file name and size on the preview header sit on one line, and the page counter (`Page 1 / 2`) no longer wraps.

## Daily report (new in this build)
This build is v84 with the **Daily report** from v81 added (see the *Daily report* section at the end).

## Company report: column filters, Edit columns, bulk Print (new)

* **Filter on every column heading.** Each heading has a small **▾** button, like Excel: sort A→Z / Z→A, search the values, tick the ones to keep, **OK**. A filled button means that column is filtered. The values offered are those left by the *other* column filters, and the filters work together with the search box, the top filters and the Pending / Dispatched / Self cards. **Clear column filters** (next to *Columns*) removes them all. The filter looks at the DCs that are loaded (the list says how many of how many); use the search to bring more in.
* **Edit columns** (appears in the bar when DCs are selected, next to *Bulk edit*). Choose any column of the sheet, **also columns that are still blank**, type a value and press **Add to all N**: it is put into every selected DC (tick *Only where the cell is blank* to keep existing values). The column then appears in a table with one box per DC, so each DC can also be typed by hand (**Enter** goes to the next DC; paste a column copied from Excel into the first box and it fills downwards). Courier, CN no, Dispatch date, Received by and Notes are offered too, with a different value per DC. **Save changes** writes the changed cells into each company's Excel sheet (same rules as the Edit button) and the app. A column that identifies the row (PO, P.R, Order ID) cannot be changed here. Server: `POST /api/dc/cells`.
* **Print / PDF / Excel** (same bar): one row per item of the selected DCs, laid out like the company item sheet: DENO, NAME OF ITEMS (+ item code), UNIT, PRICE, AMOUNT EXCL S.TAX, TAX %, TAX VALUE, TOTAL AMOUNT INCLS TAX, ITEM CODE, DC No#, INVOICE# (both yellow), Requisition, PONO, Deliver-To, COST CODE, PERSON, CONTACT, with a TOTAL row. The items and the invoice / address / person / contact come from the DC items sync (bill tab first, then the DC tab, then items typed in DC files). A DC with no items is listed with a note instead of being dropped. Excel has filter buttons on the heading; PDF is A4 landscape. Server: `POST /api/dc/items-export` (`format` = `xlsx`, `pdf` or `json` for the Print window).
* Fixed: the **Mark billed in ERP / Mark non billed** buttons in the bulk bar did nothing (a duplicate `class` attribute) and their text was hard to read on the dark bar.

## Company report: Search by item (new)

Next to the main search box there is a **Search by item…** box. Type an item name or item code and the list shows only the DCs that contain it.

* **Every word must be found** in the item name or code, in any order, and part of a word works: `stapler` and `stap` find *STAPLER 24/6*; `stapler 24/6` finds only the DCs with both.
* It looks in the same items the DC shows: the items read automatically (DC items sync: sheet, upload, ERP) and the items added by hand in DC files.
* It works **together with every other filter** (company, dates, pending / dispatched / self, billed) and with the main search box (e.g. a PO number + an item).
* A **Matching items** column appears while you search by item (item name × qty unit), so you see what matched without opening the DC. It also appears in **Print, PDF and Excel**, and the item is written in the report header.
* **Clear filters** clears it too. The same box is on the DC files page. One letter is ignored (type at least 2).
* Server: `GET /api/track/search`, `/api/dcs/page` and `/api/orders/export` accept `item=<words>`.

## DC items tracked automatically, and the ERP setting (new)

**DC items sync** (left menu, administrator) makes every DC fill in its own items. Nothing is typed, pasted or attached per DC any more.

* **Add source** and choose where the items of your DCs live:
  * **Sheet link**: a OneDrive / SharePoint / Google Sheets share link (or a file path on the server) to the Excel / CSV file that lists the items of all your DCs. **Every tab** of the workbook is read (the items are often not on the first tab). OneDrive / SharePoint links usually need the Microsoft sign-in (Order tracking page) once.
  * **Uploaded file**: upload the Excel / CSV file once. Needs no sign-in. Upload a newer copy any time.
  * **ERP list**: an address of your ERP that returns the item lines of all DCs (JSON or CSV, bearer token / user + password / your own header). If the lines are nested inside each DC record (Odoo `order_line`, ERPNext `items` ...) type where in *Item lines are inside each record at*.
  * **ERP lookup (per DC)**: an address with `{dc}` (or `{po}`, `{pr}`, `{branch}`, `{company}`) in it, e.g. `https://erp.example.com/api/dc/{dc}/items`. The desk calls it when a DC is opened, or for every DC without items with **Fetch for all DCs**.
* **One workbook feeds both prints.** A tab named after the DC (*FROM DC*, *DC LIST*) is used by **Print DC** (items, EXP codes, Deliver-To, PERSON, CONTACT, PO, REQ; no prices) and a tab named after the bill (*BILLS*, *INVOICE*) by **Print bill**. These tabs are always read, even when *Only read these tabs* lists others; the tab table shows what each tab is used for.
* **Map layout** (DC items sync → Letterheads → Edit → *Map layout…*): a paper preview of the Bill or the DC where you drag the title, company name, address, logo, NTN / GST lines, phone, date, the Invoice / DC / PO / REQ / Branch block, M/S name and address, contact lines, bank details, totals box, stamp and signature lines to where you want them (arrow keys nudge, Shift = 5 mm). The list on the right gives exact positions, a size % and a show / hide box. Bill and DC are set separately, per letterhead; the item table keeps its fixed place.
* The desk reads each source again every few minutes (you choose), so new DCs and new items appear by themselves. A file that has not changed is skipped.
* **How a row is understood**: by its headings (*Item / Description / Name of items*, *Qty / Quantity / DENO*, *Unit*, *Price*, *Item code*) and tied to its DC by the **DC no**, **PO no** or **P.R / Req no** on the row, or by the *DC # / PO # / REQ # / Branch-cost code* lines written above an invoice-style table (several invoices stacked in one tab are fine; a DC no written once above its rows applies to the rows below it). An item cell like `STAPLER 24/6` + new line + `10000401` is split into item and code. If a heading is not recognised, type its exact text under *Advanced*.
* **Company report**: a DC shows an *N items* tag; open the DC to see them, with *read automatically from <source> → <tab> · matched by DC no*. Set each item *Pending / Delivered / Short / Returned*: the status is kept when the sheet is read again.
* **Matching**: DC no first, then PO no, then P.R no (each can be switched off). *Company must agree* ignores a number that belongs to another company. The same items listed on several tabs (BILLS, WITH BC, OVERALL DATA ...) are shown once.
* The top of the page shows how many DCs have items and which number matched them (and how many of your DCs each number *would* match), and **Check one DC** explains why a DC shows no items.
* Items added by hand in **DC files** still work and win over the automatic ones for that DC.
* The items index is kept in `data/itemsync/` (about 12 MB for 6,800 DCs and 60,000 item rows).

## DC file & items, and Bulk add quotations (new)

* **Company report → open a DC → DC file & items.** Add the DC file (PDF, picture, Word, Excel; an Excel / CSV file is read for its items automatically). List the items of the DC (**Paste items from Excel**, **Add item**) and track each one: *Pending / Delivered / Short / Returned*, quantity received and a note. The customer / handler phone rows are folded under **Contacts**.
* **Quotations → Bulk add.** A sheet opens; copy the items in Excel (Description, Qty, Unit, Price, GST; a heading row is recognised) and paste into it. Press **Make quotation** and the quotation editor opens with every item filled in.

## DC files section (changed)

**DC files** (left menu) is now the place where a company is handed to a team member together with its sheet.

* **Administrator → Assign company**: type the company name, paste its **OneDrive / SharePoint / Google Sheets link or ERP export link** (Excel or CSV), and pick the team member who looks after it. The desk reads the sheet right away and then every few minutes. *Edit* changes the link or the person, *Sync* reads it again, the bin removes it.
* **Everyone**: the *Companies* box shows how many DCs each company has; below it is the same DC list as **Company report** (counts, filters, columns, expandable rows). A team member only sees the companies assigned to them.
* **Edit** on a DC changes it in the app **and writes it into the company's sheet** (status, courier, CN, dispatch date, received by, notes). Select several DCs for a bulk edit.

## Quotations (new)

**Quotations** (left menu, everyone on the team) makes a quotation on your own letterhead and sends the PDF by email or WhatsApp.

* **New quotation** opens a form that already has your letterhead, **today's date**, the next quotation number (`QT-2026-0001` ...), your default terms and the default GST. Fill in *Quote to*, add the items (description, qty, unit, unit price, GST %) and the totals are worked out as you type.
* **Everything can be changed.** Open the *Letterhead* part of the form to change the company name, address, extra lines (phone / UAN / NTN / email), form title, colour, the name under "Regards", the currency, the **logo** and the **signature / stamp** (any picture; it is converted for you). That changes only this quotation. Press *Use this letterhead for all new quotations* (or the **Letterhead** button on the page) to change it for the whole team. Old quotations keep their own copy.
* **Preview PDF** shows the finished form before you save. Long item lists continue on further pages.
* **Send** (after saving, or *Save & send*):
  * **Email**: the PDF is attached, the mail goes from the account set in *Reports → Email settings* (or your Gmail mailbox), and your own email signature is added.
  * **WhatsApp**: the PDF goes to the number you type (`923001234567`, or `0300 1234567`) as a file with a short message, and it appears in your WhatsApp inbox. Needs a connected WhatsApp (Settings → WhatsApp connection).
  * **Download / Open / Share**: save the PDF and send it any other way; on a phone, *Share* offers WhatsApp, Gmail and so on.
* The list shows every quotation (search by number or customer), whether it was sent and to whom, and has *Copy* (same quotation with today's date and a new number) and *Delete* (the person who made it, or an admin).
* The PDF is drawn by the app itself (no extra packages). It uses the standard PDF font, so English letters, numbers and common symbols print perfectly; Urdu / Arabic text is not supported in the PDF.
* First run: the letterhead is pre-filled from the M.R. Enterprises quotation form (logo, stamp, address, terms). Change it in *Letterhead*.

## 0. Use the number that is on your phone (no Meta account needed)
**Settings → WhatsApp connection → Show QR code.** On the phone: WhatsApp → *Linked devices* → *Link a device* → scan. (No QR? Choose *Use a code instead*, type your number, and enter the 8-letter code on the phone.) From then on the desk works like WhatsApp Web for that number, for the whole team:

* every customer message arrives in the inbox (bot / routing / order tracking work as before);
* the team can reply with **text, voice messages (microphone button), photos, videos and files** (paperclip button, paste or drag a file into the chat); customers' voice notes, pictures and files can be played / opened in the chat;
* messages you type on the phone itself show in the desk too (for chats the desk already has);
* **Settings → WhatsApp connection** also has: *Auto-reply bot* on/off (off = plain shared inbox), and *Decline WhatsApp calls with a message*.

Good to know:
* **Calls.** WhatsApp does not allow a linked number to start or answer calls from a computer. Incoming calls are written in the chat; use the **Call** (phone / dialer) and **WhatsApp** (opens the chat in WhatsApp) buttons to ring a customer. Real in-browser calling exists only in Meta's separate Cloud Calling API (requires Meta approval and a number registered with them).
* **Calling without the API:** WhatsApp Web now has voice and video calls (rolled out mid-2026). Next to every customer the desk shows a **Web call** button that opens that chat in WhatsApp Web (always in the same tab). Each team member signs in to WhatsApp Web once (Linked devices) and uses the call icon there. Calls ring on every device linked to the number, not only for the person handling the chat, and WhatsApp allows only a few linked devices (the desk uses one).
* A linked phone cannot send WhatsApp's tappable list menus, so the bot's menu is sent as a numbered text list (customers answer `1`, `2` ...).
* This uses an unofficial WhatsApp Web connection (the open-source Baileys library). Use it for normal customer service, do not bulk-message people, and keep the phone online now and then. Everything is stored in `data/wa-auth` (keep it private; deleting it unlinks the number). Unlinking also works from the phone (*Linked devices*).
* Running without Docker: run `npm install` once in the app folder, and install ffmpeg (`sudo apt install ffmpeg`).
* The official **Cloud API** (sections below) still works. With its keys in `.env`, **Settings → WhatsApp connection → "Use the official WhatsApp Cloud API"** switches between the two: ticked = Cloud API (tappable menus, calls from the desk), unticked = your linked phone (free, no templates). Only one is active at a time; the other is paused (the webhook is ignored while unticked, and the linked phone does not answer while ticked).

## WhatsApp links, in-desk voice calls and the API switch (new)

**Admin → WhatsApp links** (left menu)
* **Add link** → a name, a web-address ending (e.g. `sales` gives `https://your-desk/go/sales`), who handles it, and what to ask (name, phone, organization, PO / order number, message; each *Don't ask / Ask / Must fill in*). Copy the link, or press **QR** to download a QR code for print or a website.
* The customer opens it, fills in the details and WhatsApp opens with the message already written (it carries a short `Ref:` code). When the message arrives, the desk **connects the chat to the right person** and writes the details at the top of the chat:
  * *Handled by* a named person → always that person (if off duty: the organization's person, then the least busy member);
  * *Handled by "decide by the organization they type"* → the person who handles the organization the customer typed (main, then backup, then least busy).
* **Send people to**: *the desk number* (chat arrives in the inbox, normal), *the handler's own WhatsApp number* (Team → Phone; the chat happens on that person's phone, outside the desk), or any other WhatsApp number / `wa.me` link.
* On the same page set the **desk number** (filled automatically when a phone is linked; type it when you use the API) and the **public address** of the desk (the https address customers can open; needed for links and call links to work from a phone).

**The switch: "Use the official WhatsApp API"** (WhatsApp links page and Settings → WhatsApp connection)
* **Ticked** → everything runs on the official Cloud API (menus with buttons, calls on the customer's WhatsApp from the desk). Needs `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in `.env`, otherwise the box stays disabled.
* **Unticked + "Make only the calls go through the API"** → chat, links, bot and voice messages stay on your linked number; only WhatsApp **calls** use the Cloud API. Meta requires the API number to be a **separate number** (a number on the Cloud API cannot also be linked like WhatsApp Web), so calls come from that number. Meta's limits apply: customer must allow calls (1 permission request/day, 2/week), up to 100 calls/day per customer, no business-initiated calls from US, Canada, Egypt, Vietnam or Nigeria numbers, and the API number needs a 2,000-contacts daily messaging limit. Subscribe the webhook to `calls` and `messages` in Meta.
* **Unticked** → everything runs on your own number linked to the desk (QR code, like WhatsApp Web): chat, voice messages, photos, files, the bot, the links above and the free **Voice call** below. The API is paused.

**Voice call inside the desk, no API.** WhatsApp does not allow a linked number to place or answer its *own* calls from a computer (only the paid Cloud API can). So the desk has its own browser-to-browser voice call:
1. In a chat press **Voice call**. The customer receives a *Tap to pick up call* message in WhatsApp (in the desk it shows as a button; on a linked phone WhatsApp can only show it as a tappable address; with the Cloud API it is a real button).
2. The customer's screen looks like a phone call: **Accept** (green) and **Decline** (red), then **Mute** and **End**. Accept connects at once if you were waiting; Decline tells you.
3. The same link opened later by the customer rings the person who handles that chat. Missed and finished calls are written in the chat.
* Needs https (or localhost) so browsers allow the microphone. On some mobile networks add a TURN server in `.env`: `TURN_URL`, `TURN_USER`, `TURN_PASS`.
* Voice only (no video). With the API box ticked, the existing **Call** button rings on the customer's own WhatsApp instead.

## With API or without API, and who gets new messages (new)

**Settings → WhatsApp connection** (administrator) now starts with a clear choice:

- **Without API** (your own number, linked like WhatsApp Web): free, no message limits, no templates, no 24-hour rule. Customers still get the same welcome message and menu (as a numbered list: they reply 1, 2 …).
- **With API** (official Meta Cloud API): tappable buttons and calling from the desk, but Meta's limits and fees apply. This option is greyed out until `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are in `.env`.

Only one is active at a time. Switching is instant and keeps all chats.

**Without API, every new chat goes straight to the person who handles that customer's organization.** Under *Who gets new chats (without API)*:

- **Assign every new chat automatically** (on by default). The desk finds the customer's organization from their phone number in your order sheets (or from what they type, e.g. "I'm from Hilton"), and gives the chat to that organization's contact (or the backup when they are off duty). The chat appears in that person's **Mine** list from the first message. The customer still gets the welcome menu, and the bot can still answer order tracking; it steps aside as soon as a team member replies, from the desk or from the phone itself.
- **If the organization is not known** (the number is not in your order sheets), the customer gets your normal welcome menu and nobody is assigned yet. When they tap **Track my order**, **Talk to our team**, or type **call**, the bot first sends your prebuilt "tell us the name of your organization" message. Once they answer, the chat goes straight to that organization's person (main, then backup when off duty): *Talk to our team* connects them, *call* sends that person's number, *Track my order* assigns the person and keeps the order lookup working. If you prefer, choose a fixed person in Settings to receive unknown customers right away (they are still asked for their organization). An organization the desk does not know gets your "not found" message and the chat goes to the least busy person, so nothing is lost. A voice note or photo goes straight to the chat's owner.
- **Returning customers stay with their usual person** (on by default). Untick to decide again every time from the customer's organization.
- **Team members see only their own chats** (on by default). Each person sees just the chats assigned to them (no *Unassigned* / *All* tabs); the administrator sees everything and can move a chat to someone else, after which it disappears from the previous person's screen at once.
- **Send the welcome menu automatically**: untick for a plain shared inbox (chats are still assigned, nobody gets an automatic answer).

The assigned person does everything from the desk: text, voice notes, photos and files, links, the in-desk **Voice call** button, PO / P.R / CN lookups. (WhatsApp does not allow a linked number to ring or answer WhatsApp calls itself, so calls use the desk's browser voice call or the phone **Call** button.) Nothing changes when *With API* is selected: the shared inbox works as before.

## WhatsApp groups: the administrator assigns, the team member chats and calls (new)

Works **without the API** (your own linked number). Every group the number is in can be handled in the desk.

* **Admin → Groups** (left menu) lists every group your number is in. Next to each group, **Handled by** picks the team member who looks after it (or *Nobody* = only the administrator). *Refresh groups* reloads the list from the phone. A group also appears the moment someone writes in it. Messages show the sender's name and number.
* **The team member** sees only the groups assigned to them (in **Mine** and the **Groups** tab). In their groups they can **send messages, photos, files and voice notes** and press **Voice call**. Nothing else: no assigning, resolving, deleting, forwarding or AI helper (the server refuses these, not just the screen). A group that is not theirs is invisible to them. When the administrator moves a group to someone else, it disappears from the previous person's screen at once.
* **The administrator** can do everything in every group: read, chat, voice-call, assign / un-assign (also from the box at the top of a group chat), resolve / reopen and delete messages.
* The welcome bot **never** answers in a group, and *Resolve* does not post anything into the group. A new message reopens a resolved group.
* **Voice call in a group:** WhatsApp does not let a linked number start its own group call, so the desk posts its browser voice-call link in the group. The first member who opens it talks with the team member in the desk (one person at a time, voice only, same as the customer call described above).
* Messages you type on the phone itself in a group also show in the desk. Groups are never marked as read automatically (that would show blue ticks to everyone in the group).
* **Settings → WhatsApp connection → Bring WhatsApp groups into the desk** switches all of this on or off (on by default). With the official API selected, groups are paused (the API has no group chats).

## Hosting notes (Synology NAS / Railway) and "message arrives but nothing shows"

* **Run the desk in ONE place only.** A WhatsApp number can be linked to one copy of the desk at a time. If the same number is linked on Railway *and* on the NAS (or the app is started twice), they fight each other and messages arrive unreadable or not at all. Stop one of them, then press **Unlink**, delete the old entry in WhatsApp → Linked devices, and link again.
* **Docker installs the WhatsApp library when the image is built**, so `npm update` alone changes nothing. After replacing the files, rebuild: Synology `docker compose build --no-cache && docker compose up -d` (or Container Manager → Project → Build); Railway → redeploy.
* **Keep the data folder.** The link to your phone lives in `data/wa-auth`. On the NAS it is the `./data` volume (already in docker-compose.yml). On Railway add a **Volume** mounted at `/app/data`, otherwise every redeploy forgets the link and the chats.
* **“No matching sessions found” in Recent activity** means WhatsApp sent the message under its newer *LID* address and the library could not decrypt it. The 6.x library cannot do this reliably; this version uses Baileys 7 (release candidate), which supports LID. After rebuilding, Unlink, delete the old entry in WhatsApp → Linked devices, and link again (the old session cannot be reused).
* **Settings → WhatsApp connection → Recent activity** shows what happens to each incoming message (delivered, skipped and why, reply sent or failed).

## 1. Try it in 1 minute (no WhatsApp needed)

```
node server.js
```
Open http://localhost:3000 . Sign in with **username + password**: admin / `1234` (the `ADMIN_PIN` in `.env` is the first admin password), or a demo team member (sara / 1111, bilal / 2222, hina / 3333, omar / 4444).
Click **Test phone** (bottom right) and chat like a customer: say "hi", pick *I'm from an organization*, type "Hilton". Then open the Inbox as Sara and watch it arrive.
Try tracking with order `ORD-1001`.

## 2. Make it your own
* **Team** – add your 5–6 people, give each a **username and password** (Team → Add team member).
* **Organizations** – add each company, other names people use for it, the person who handles it, and a backup.
* **Order tracking** – add one sheet per company, then link it to OneDrive or drag its Excel file onto the page. Use *Merge* for daily updates (matching Order IDs are updated, the rest kept). Column names are flexible (e.g. "Order No", "Mobile", "Company"). Put phone numbers with country code (e.g. 923001234567) so customers see their orders just by messaging.
* **Settings** – edit every message the bot sends, and the four menu buttons.

### Order sheets: one per company (BAFL, other clients…)
**Order tracking → Add company sheet.** Give each company its own sheet: a name (e.g. `BAFL`), its OneDrive / SharePoint share link (or leave the link empty and upload its Excel file), and how often to re-read it. Each sheet has its own **Columns** button, so BAFL can have "P.R no / PO no / CN no" in different columns from another company. Syncing or uploading one sheet only replaces **that company's** orders; the others are never touched.

* A customer who sends a PO, P.R or CN number gets the answer from whichever sheet contains it.
* If the customer already told the bot which organization they are from (e.g. "I'm from BAFL"), that company's sheet is used first, so a PO number that exists in two companies' sheets shows the right one. Name the sheet the same as the organization (or one of its "other names").
* A customer already connected to a team member can still send just a number (e.g. `366809`) and the bot answers instantly from their company's sheet.
* If a number is in several sheets and the customer's company is not known, every match is shown with a `Company:` line.

### Microsoft app (client) ID — for OneDrive / Excel links
OneDrive often refuses to give a file to a program that is not signed in ("401 unauthenticated"), especially for the newer `1drv.ms/x/c/…` links. Give the desk a Microsoft app (client) ID, sign in once, and it reads your sheets as a real Microsoft user (read-only, through Microsoft Graph). Then every link works, even "Specific people" links, as long as the account you sign in with can open them.

1. **portal.azure.com** (a free Microsoft account is enough) → **App registrations** → **New registration**. Name `WhatsApp Desk`. Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*. Leave Redirect URI empty. Register.
2. Copy the **Application (client) ID**.
3. **Authentication** → *Advanced settings* → **Allow public client flows = Yes** → Save.
4. **API permissions** → Add a permission → Microsoft Graph → **Delegated** → **Files.Read.All** (press *Grant admin consent* if your company requires it).
5. In the app: **Order tracking → Microsoft sign-in → Set up** (or Settings → Microsoft app (client) ID). Paste the client ID, press **Sign in with Microsoft**, open `microsoft.com/devicelogin`, type the code shown, and sign in with the account that can open your sheets. Then press **Sync now** on each sheet.

You can also set `MS_CLIENT_ID` (and optionally `MS_TENANT`) in `.env`. The refresh token is stored in `data/db.json`; keep that file private. Nothing is ever written to OneDrive.

### Scheduled email reports
**Reports → Email settings**: enter the mailbox the reports are sent from (Gmail: `smtp.gmail.com`, port 587, STARTTLS, use an *App password*; Microsoft 365: `smtp.office365.com`, port 587, STARTTLS, SMTP sign-in must be enabled for that mailbox). Press *Save & send test*.
**Reports → New report**: choose the data (organizations, statuses, updated in the last N days, text, columns), the files (Excel, PDF or both), the email addresses, the time and the days. Make as many reports as you like, each with its own data and its own people, e.g. "Shipped orders" to the warehouse every morning and one report per organization to its account manager every Monday. *Send now* sends immediately, *PDF / Excel* download a copy. Reports read the same order list as WhatsApp, so with the OneDrive link connected they always contain your latest Excel data. Times use the server's time zone (default Asia/Karachi, change with `TZ` in `.env`). If the server was off at the scheduled time, the report is sent when it starts again (within 90 minutes).

## Shared email inbox (fully integrated with Gmail)
Several Gmail addresses, several people, each seeing only their own companies' mail. Everything stays in step with Gmail.

1. **Gmail side (once per address):** turn on 2-Step Verification, then Google Account → Security → *App passwords* → create one. In Gmail → Settings → *Labels*, keep **All Mail** set to "Show in IMAP" (default).
2. **Email → gear button** (admin) → *Add Gmail address*. Add as many as you like. Optionally mark a mailbox as **dedicated to a company**: everything arriving there goes to that company's person.
3. **Organizations → Edit:** fill *Email domains or addresses* (e.g. `hilton.com, buyer@hilton.com`) and *Handled by* (+ backup). Mail from those senders goes to that person; a company name in the subject also matches. Unmatched mail waits in **Unassigned** for the admin.
4. **Each person sees only their own emails** (the admin sees everything).

**What syncs with Gmail (both directions):** read/unread, star, **Done = archive** (and *Move to inbox*), and labels (add, remove, create new ones; accents work). Changes made in Gmail itself, including deleting a mail, show up in the app at the next check (1–60 min, you choose or press *Sync*).
**What people can do:** read HTML emails (shown in a sandbox, remote pictures hidden until "Show pictures"), reply / reply all / new email with attachments, download attachments, search by subject, sender, label or company, filter by label or mailbox, hand a thread over. Replies are sent from the chosen Gmail address (name of the person + mailbox name) and land in Gmail's *Sent*; mail you send from Gmail directly also appears here.

Notes: the app reads Gmail's **All Mail**, so every label is visible, and drafts, spam and trash are ignored. Non-Gmail servers (e.g. Microsoft 365: `outlook.office365.com` / `smtp.office365.com`) work with read + star sync only; labels and archive are Gmail features. Attachments are stored in `data/mail/`. Removing a mailbox in the app never deletes anything in Gmail. No npm packages are needed.

## Retail shops and QuickBooks (Online and Desktop)
**Retail shops** page: every shop has an account number. In WhatsApp a shop chooses *Retail shop account*, sends its number and gets its details, **sales person**, price list (by region or per shop), balance and open invoices, and its orders. A shop that is new types **NEW**, answers a few questions (name, contact, phone, address, city, region: Sindh, Punjab, Khyber Pakhtunkhwa, Balochistan… editable under *Regions & settings*) and receives its own account number such as `RT-PB-0001`.

* **QuickBooks Online (live):** *Retail shops → QuickBooks Online → Connect*. Create an app at developer.intuit.com (QuickBooks Online and Payments, scope Accounting), paste its Client ID and secret, add the redirect address shown in the dialog to the Intuit app, and approve. The desk then reads customers, products and open invoices every few minutes, and **every shop that registers in WhatsApp is created in QuickBooks as a customer** (display name `Shop (RT-PB-0001)`, phone, address, and `Account No: …` in Notes). If QuickBooks is unreachable the shop is kept and sent later (*Send waiting shops*). Existing QuickBooks customers use the number written as `Account No: XXXX` in their Notes, otherwise `QB-<id>`. Region comes from the billing State/Province or City.
* **QuickBooks Desktop / Excel:** Desktop has no cloud connection, so export the customer list, products and open invoices to Excel/CSV and upload or link them (OneDrive, or a NAS folder). New shops are always appended to `data/retail-new-shops.csv` and can be downloaded as **New shops (QuickBooks CSV)** to import into Desktop.
* New shops can be marked *pending* until an administrator approves them (*Regions & settings*), but they are sent to QuickBooks straight away when automatic creation is on.
* Environment alternatives: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENV` (`sandbox` or `production`). Intuit only accepts an https redirect address for Production (http://localhost is fine for testing).

## 3. Connect your real WhatsApp number with Meta's Cloud API (optional)
1. Go to https://developers.facebook.com → *Create app* → type **Business** → add the **WhatsApp** product.
2. In *WhatsApp → API Setup* copy the **Phone number ID** and an access token. (The temporary token expires in 24h; for production create a *System User* token in Business Settings with `whatsapp_business_messaging` permission.)
3. Copy `.env.example` to `.env`, fill in `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN`, `APP_SECRET`, change `ADMIN_PIN`, and set `SEED_DEMO=false` once you have added your own data. Restart the server.
4. Meta needs a **public https address** for the webhook. Host this on any server/VPS (`node server.js`, ideally behind a reverse proxy with https, kept running with pm2 or systemd), or for testing use a tunnel: `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.
5. In *WhatsApp → Configuration → Webhook*: Callback URL `https://YOUR-ADDRESS/webhook`, Verify token = your `WEBHOOK_VERIFY_TOKEN`. Then **subscribe to `messages`**.
6. Message your number from your phone. The dashboard switches from *Demo mode* to *WhatsApp connected*.

### WhatsApp calls (Cloud API)
With the Cloud API connected, the **Call** button beside a customer rings them on WhatsApp from your business number (audio runs in the browser; allow the microphone). Customers who call your number ring in the desk with Answer / Decline. Call results ("Call ended · 1:05", "Missed WhatsApp call") are written in the chat.
One-time setup in Meta: (1) **WhatsApp Manager → Phone numbers → your number → Calling → turn on** (or Settings → *Switch on calling for this number*); (2) **Developers → your app → WhatsApp → Configuration → Webhook → subscribe to the `calls` field** (as well as `messages`); (3) customers must **allow calls** before you can ring them: if they have not, the desk offers to send them a one-tap permission request. Meta may limit business-initiated calling to numbers that meet its eligibility rules.

## Things to know
* **24-hour rule.** WhatsApp only allows free-form replies within 24 hours of the customer's last message. After that, Meta requires an approved template message. The dashboard tells the agent when a reply is blocked.
* **Business-initiated messages** (e.g. pushing "your order shipped" without the customer asking) need approved templates. This version answers customers when they ask; proactive updates can be added with a template.
* **Data** is stored in `data/db.json`. Back it up. Keep the dashboard behind https if exposed to the internet; set `APP_SECRET`, and change the default admin password right after the first sign-in.
* **One WhatsApp number cannot also be used in the normal WhatsApp Business phone app** at the same time as the Cloud API (use a number dedicated to this).

## Files
```
server.js        web server, API, WhatsApp webhook
lib/bot.js       menu flow, organization matching, routing
lib/orders.js    Excel import and order lookup
lib/sync.js      company sheets: live OneDrive / SharePoint / folder sync
lib/msgraph.js   Microsoft app (client) ID sign-in + Graph file download
lib/qbo.js       QuickBooks Online: live customers/products/invoices, creates new shops
lib/reports.js   scheduled PDF + Excel email reports
lib/pdf.js       PDF writer
lib/mailer.js    email (SMTP) sender
lib/imap.js      Gmail/IMAP reader + email parser
lib/inbox.js     shared email inbox: routing, threads, replies
lib/xlsx.js      built-in .xlsx reader (no dependencies)
lib/whatsapp.js  WhatsApp Cloud API sender
public/          the dashboard
```

## Running on a Synology NAS (Container Manager)
1. DSM → Package Center → install **Container Manager**.
2. In File Station create `docker/whatsapp-desk` and upload the unzipped folder contents there. Copy `.env.example` to `.env` and fill it in (set `SEED_DEMO=false`).
3. Container Manager → **Project** → Create → path `docker/whatsapp-desk` → it picks up `docker-compose.yml` → Build and start. Your data lives in the `data` folder next to it, so updates never erase it.
4. Open `http://NAS-IP:3000` on your network to use the dashboard.
5. Public https for WhatsApp (pick one):
   * **Synology DDNS + reverse proxy:** Control Panel → External Access → DDNS (free `yourname.synology.me`). Control Panel → Security → Certificate → add a Let's Encrypt certificate. Control Panel → Login Portal → Advanced → Reverse Proxy → create a rule: source HTTPS `yourname.synology.me` port 443 → destination HTTP `localhost` port 3000. On your router forward port 443 to the NAS.
   * **Cloudflare Tunnel** (no router changes): run the `cloudflare/cloudflared` container pointing to `http://whatsapp-desk:3000`.
   Then use `https://yourname.synology.me/webhook` as the Callback URL in Meta. QuickConnect does not work for webhooks.

## OneDrive sheet link troubleshooting
If "Sync problem" says OneDrive refused access even though the file is set to *Anyone with the link can view*: newer `1drv.ms/x/c/...` links often cannot be read automatically. In OneDrive open the file → Embed → Generate, copy the address inside `src="…"`, and paste that instead. The app now also tries several other download methods and lists what it tried in the error message.

### Most reliable option: read the Excel file from a folder on your NAS (no link needed)
1. On the Synology, install **Cloud Sync** and sync your OneDrive folder (or just the file) to a NAS folder, e.g. `docker/whatsapp-desk/sheets`.
2. Keep the `./sheets:/sheets:ro` line in `docker-compose.yml` (already added), so the container sees that folder.
3. In the app, paste the path instead of a link in a company sheet: `/sheets/bafl.xlsx` (your file name), choose how often to check, **Save**. Editing the sheet in Excel updates OneDrive → the NAS → the app.

## Order tracking by PO / P.R / CN number
**Order tracking → Columns** on a company sheet (admin): choose the Excel **tab**, the **header row** (found automatically, so title rows above the headers are fine) and which column is **P.R no**, **PO no** and **CN no** (consignment / tracking). Columns with no header can be picked as "Column C". Tick the extra **details** customers should see (address, order date, dispatch date, packages…). A live preview shows exactly the WhatsApp reply.
Customers can then send any PO, P.R or CN number (e.g. `366809`) and get the status and details back. If the sheet has no Status column the app uses *Dispatched* (CN or dispatch date present), *Self collection* (CN says "self") or *Pending dispatch*. Works with the OneDrive link, the NAS folder path, or a file upload.

## Call / WhatsApp, PO-P.R finder, tracking suggestion, AI assistant
* **Phone numbers:** *Team → Phone* (or when adding a member) – save each person's number with country code (`923001234567`; `0300…` is converted automatically).
* **Customer calls the person who handles their company:** the customer types **call** in WhatsApp and gets the handler's name, number and a `wa.me` link (main person, or the backup if the main person is off duty). The hand-over message also tells them to type *call*.
* **Find PO / P.R / CN** (left menu): type any part of a PO, P.R, CN or order number. Every match shows status, company, customer, courier, and **Call / WhatsApp** buttons for the customer's number on the order *and* for the team member who handles that company (plus backup). Buttons: *Copy details*, *Open chat*, *Send tracking in chat*.
* **Tracking suggestion:** when the customer's latest message is a PO/P.R/CN number or a tracking question ("where is my order?"), a yellow banner appears above the message box with the ready-made details – **Send tracking details**, **Edit first** or **Dismiss**. If no order matches it offers a message asking for the PO / CN number.
* **AI assistant** (right panel in every chat): **Suggest a reply** puts a draft in the message box; **Ask** gives step-by-step guidance. Admins open **AI settings** to choose Google Gemini or Anthropic Claude and paste the API key (or set `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` in `.env`). Without a key it still drafts replies from the order data. The AI never sends anything by itself.

## Email signature with a GIF (each team member)
**Email → My signature** (left menu of the mail screen, or click the grey signature line under any message you are writing). Everyone edits only their own signature.
* Write the text with the toolbar (bold, colour, links…) or press *Fill with my name & phone*.
* **GIF / picture:** upload a GIF, PNG, JPG or WebP (max 1.5 MB), *or* paste a direct `https://…gif` link. Pick the width. The preview shows exactly what the receiver sees.
* The signature is added automatically to new emails, replies, forwards and scheduled emails, and also appears under the message while you write. Untick *Add this signature* to switch it off.
* An uploaded GIF is attached inside the email (inline), so Gmail and Outlook show it and it animates. A Giphy/Tenor *page* address does not work; use the direct `.gif` link.

## Routing mail by CC, To and forwarded mail (colleague → client → team member)
Incoming mail is now matched on **everyone involved**, in this order: the sender, the To / CC addresses, then the original sender inside a forwarded mail (`From: …` lines). The first address that matches a routing rule or a company goes to that company's person (backup if they are off duty).
* **My company's own addresses** (Email → Routing rules): add your own domains/addresses (e.g. `mrenterprises.com`). Mail from a colleague is then routed by the *client* in CC or in the forwarded text, not by the colleague. An explicit rule on a colleague's address still works.
* **Filter from an open conversation** (admin, the tag icon in the toolbar): pick the client address (or everyone at their domain), pick the team member, and optionally hand the conversation over right away. This creates a routing rule, so future mail like it goes to that person.
* The conversation header shows *(matched address)* when the person was chosen from CC/forwarded text. *Apply to existing mail* re-routes old conversations the same way (conversations you handed over by hand are left alone).

## Retail shops: admin + assigned people, one region each
The **Retail shops** page is visible only to the administrator and to team members the administrator gives regions to: **Team → Retail regions (sees only these)** – tick one or more regions per person.
* A person sees **only the shops, balances/invoices and totals of their own regions**. Other regions are completely hidden from them, and the QuickBooks / file-upload settings are admin only.
* **WhatsApp chats with retail shops** follow the same rule: you see a retail chat only if it is yours (assigned to you) or from one of your regions. This also covers live updates and direct links.
* People with no retail region do not get the menu item, and the server refuses the data. Only the administrator can change regions.

## Sign-in: username + password
* The sign-in page no longer lists your team. Each person types their own **username and password**.
* **Existing installs keep working:** the first time the new version starts, every person gets a username (their first name in lower case, e.g. `sara`) and their old PIN becomes their password. The administrator can change both under **Team → Username & password**; everyone can change their own password (**Change password**, needs the current one).
* Passwords are stored only as salted hashes, must be at least 6 characters, and a password change signs that person out of other devices. After 6 wrong tries for a username the sign-in is paused for 10 minutes.
* Only the administrator sees usernames of other people. Forgotten password: the administrator sets a new one.

## Team page layout
Each team card is compact (name, @username, on-duty switch, phone with Call/WhatsApp, "Looks after"). Click **Settings** on a card to open its details — phone, username & password, retail regions (admin) and *Remove from team*. They stay hidden until you click, and the panel stays open while you edit.


## Latest changes
* **Reports:** CC and BCC boxes. Every column of each company sheet can be picked (with *Select all*). `#N/A` cells are treated as empty. Link columns (tracking link, image link) appear as a clickable **Open link** / **View image** in both Excel and PDF.
* **WhatsApp tracking asks for the organization first.** The customer names the organization (a sheet name, a name inside the sheet, or an organization name / other name from the Organizations page, e.g. add `BAFL` as another name of BANK AL FALAH). Only that organization's sheet is then searched. Typing *change* picks another organization. The three messages are editable under Settings.
* **Image / link columns in WhatsApp:** the link is shown in the reply (SharePoint links get `?download=1`), and when WhatsApp is connected the picture or PDF is also sent as a document the customer taps to save to the phone. Private OneDrive files need the Microsoft sign-in (see above).

## Keyboard shortcuts (Gmail style)

Press `?` in the Mail screen (or click the keyboard button in the top bar) for the full list. On a Mac use ⌘ instead of Ctrl.

**While writing (compose window and reply box):** Ctrl+Shift+C add Cc · Ctrl+Shift+B add Bcc · Ctrl+Shift+F change From · Ctrl+Enter send · Ctrl+Shift+D discard · Esc save draft & close · Ctrl+K link · Ctrl+B/I/U · Ctrl+Shift+7/8 lists · Ctrl+Shift+9 quote · Ctrl+Shift+L/E/R align · Ctrl+Shift+5/6 text size · Ctrl+[ / ] indent · Ctrl+\ clear formatting.

**Go to:** `g` then `i` Inbox, `s` Starred, `t` Sent, `d` Drafts, `c` Scheduled, `e` Done, `m` Important, `p` Spam, `b` Bin, `a` All mail, `u` Unassigned, `l` a label.

**List / conversation:** `c` compose · `d` compose full screen · `/` search · `j`/`k` move · `o`/Enter open · `x` select · `s` star · `e`/`y` archive · `#`/Delete bin · `!` spam · Shift+I/U read/unread · `+` important · `l` label · `r` reply · `a` reply all · `f` forward · `n`/`p` next/prev message · `;`/`:` expand/collapse all · `[`/`]` archive & newer/older · `u` back to list · `*` then `a n r u s` select · Shift+N refresh · Esc back/clear.

The reply box now also has a Bcc field.

## WordPress / WooCommerce store (new)

Left menu → **Store**. Admins connect the shop under **Connection & PDF**; the whole team uses **Products**.

* **Connect.** In WordPress: WooCommerce → Settings → Advanced → REST API → *Add key* (Read access is enough). Paste the shop address, Consumer key and Consumer secret in the desk and press *Test connection*, then *Sync now*. The desk then checks for new orders every few minutes (you choose how often). Products are refreshed hourly (or with *Sync now*).
* **Instant orders (optional).** WooCommerce → Settings → Advanced → Webhooks → *Add webhook*: topic *Order created*, delivery URL `https://YOUR-DESK/webhooks/woo`, secret = the one shown in the desk. New orders then arrive at once. The address must be reachable from the internet (not localhost).
* **Orders.** Shop orders appear in *Order tracking* (status read-only, it comes from WordPress) and are found when a customer sends the order number or their phone number. A courier + CN written by a shipment-tracking plugin (e.g. *Advanced Shipment Tracking*) fills the courier / CN columns, so the **Track order** button opens the courier's tracking page.
* **Order PDF.** When a new order arrives (status *processing*, *on-hold* or *completed*, changeable) the customer gets a professional PDF order confirmation on WhatsApp with your logo, items, totals, payment status, courier / CN and a tracking link. Each order is sent once, and orders that already exist when you first connect are never sent. The team can open or send the PDF of any order with the **PDF** / **Send on WhatsApp** links in *Order tracking* and in the customer panel. Logo, colour, business details, title, footer and the WhatsApp message are set in *Connection & PDF* (*Preview PDF* shows a sample).
* **Products on WhatsApp.** *Products* lists the shop's catalogue with search. **Send to a chat** (or the cart button in a chat's header) sends the product as a picture + price + link. With the official WhatsApp API and a **Catalog ID** entered, it is sent as a native WhatsApp catalog card instead (the product must be in your Meta catalog: install the free *Facebook for WooCommerce* plugin and connect the catalog there).
* Good to know: the PDF uses the built-in PDF fonts, so Urdu / Arabic letters in a name or address print as “?”. With the official WhatsApp Cloud API, WhatsApp only lets the desk send a file first to customers who wrote in the last 24 hours (an approved message template would be needed otherwise); with the linked phone there is no such limit.

## Mail update: team labels, attachment chips, faster actions
- **Admin → Gmail mailboxes → "What team members can do" → "Show the original Gmail labels…"**
  Ticked (default): everyone sees the Gmail labels, as before.
  Unticked: team members do not see the labels that already exist in Gmail. They create their own labels (private to each person, kept in the app, never written to Gmail), put them on their conversations, open them from the left list and use them in their filters. The admin still sees every Gmail label.
- **Attachment chips in the mail list**: PDF / image / file chips (up to 3, then "+N") under each mail, like Gmail. Click one to open it without opening the mail (it stays unread).
- **Speed**: opening a mail and Read / Unread / Star / Done / Delete / Label now change on screen at once. Gmail is updated in the background over one kept-open connection (before, every click made a new Gmail login and waited for it, then reloaded the whole mailbox).

## Email: ordering, loading all Gmail, and search (update)
* **New mail is ordered by when Gmail received it** (not the sender's `Date:` header, which can be hours off), so a new email lands on top at once and flashes blue for a few seconds.
* **All old Gmail is loaded in the background**, newest first, on its own connection and several mails per round trip, with a "Loading all your Gmail… N left" bar. It never delays the 10-second check for new mail.
* **Search works like Gmail**: `from: to: cc: bcc: subject: label: in: is: has:attachment filename: larger: smaller: after: before: older_than: newer_than:`, `"exact phrase"`, `-exclude`, `OR`, `{a b}`, `( )`. Results appear instantly from the mail already loaded, then Gmail itself searches ALL mail (any language) and any hit not loaded yet is fetched automatically. The box shows suggestions (operators, people, labels) and your recent searches; Enter searches at once, Esc clears.

## Overview, Find PO and ERP integrations (update)
* **Overview → Orders**: filters for member and company, period buttons (All time · Today · Week · Month · Year) or a From–To date range, and a **Clear filters** button. Cards show **Dispatched · Self · Pending** (tap one to open the list in Find PO). The old team-members table moved to Find PO.
* **Find PO / P.R**: the same panel (with the member table) above the number search. The filters also narrow the search; with no number typed, the matching orders are listed.
* How an order is grouped: *Pending* = status says pending, or confirmed / processing / packed / empty; *Self* = status or courier says self / collection / pick-up; *Dispatched* = dispatched, shipped, out for delivery, delivered, or it already has a CN. Cancelled / returned are counted as "other". Periods use each order's DC date / order date.
* **Integrations** (admin): (1) read orders from any ERP address (REST / JSON / OData / CSV link, with sign-in, paging and field mapping; starting points for ERPNext, Business Central, SAP, Odoo); (2) **Push API** — `POST /api/erp/push` with an API key, and `GET /api/erp/orders` to read back; (3) **webhooks** to tell the ERP when a status changes here (optionally signed, optional custom body).

## Edit button on a DC: update it here, the Excel sheet follows (new)

In **Company report** every DC row has an **Edit** button (blue on pending ones). It opens a small form: **Status, Courier, CN no, Dispatch date, Received by, Notes**. Press **Save** and the change is written into that row of the company's Excel sheet and shown in the app at once (counts, filters and the pending list update too).

* **OneDrive / SharePoint link:** needs the Microsoft sign-in with *edit* permission. In Azure → your app → API permissions → add Microsoft Graph → Delegated → **Files.ReadWrite.All**, then press **Sign in with Microsoft** once more. The signed-in account must be able to edit the file. Only the changed cells are written (it uses the Excel API; if that is not available for the file, it downloads, changes and uploads the file with a version check).
* **File on the server (folder path):** the .xlsx is changed in place, so the folder must be shared with the app with write access.
* **Sheet uploaded by hand:** there is no sheet to write to, so only the app's copy changes.
* Only fields that exist as columns in the sheet can be edited (others are greyed out). Dispatch date goes to a column with "dispatch" in its name (or "Last updated").
* Safety: before writing, the app checks that PO / P.R / CN in that Excel row still match. If someone sorted or edited the sheet meanwhile, nothing is written and it asks you to press **Sync now**.
* After upgrading, each sheet learns its row/column positions on its next sync (within a few minutes, or press **Sync now**).

## PO follow-up (admin → "PO follow-up")

* **What counts as a DC:** in a sheet that has *DC no*, *Cost code / Branch code* and *Description / Address* columns, a row is a DC only when all three are filled in. Rows that only hold a pre-filled DC number are ignored. PO and P.R (Req no) may be empty. Excel errors such as `#N/A` are treated as empty.
* **Waiting for a PO:** every DC that is dispatched (dispatch date / CN / dispatched status) and has no PO. A DC leaves the list as soon as it has a PO, typed in the app or in your Excel sheet.
* **Add a PO:** type it next to the DC (or use *Add many POs*: one `DC PO` pair per line). It is kept in the app and, when the sheet can be written to, also written into the PO column of the Excel file.
* **Reminder mails:** *New reminder* → email of the person who makes the PO, first time of day, repeat every N hours until a chosen time, days of the week, PDF and/or Excel attached. The mail asks them to make the purchase orders and repeats until no DC is left waiting. Uses the same email account as Reports.

## Email stays fast: one year in the app, older mail on your NAS (new)

* The app keeps the last **365 days** of email. Everything older is moved (a few hundred conversations at a time, in the background, starting 20 seconds after the app starts) to the archive folder (`MAIL_ARCHIVE_DIR`, `/archive` in Docker). Point that folder at a shared folder on your Synology in `docker-compose.yml`. Nothing is deleted from Gmail.
* **Email → More → Older mail (archive)** searches that folder (sender, subject, label, organization, words from the mail, attachment names) and opens any conversation with its pictures and attachments. It is read-only; press **Restore to my mailbox** to reply or forward (it stays in the mailbox for 30 days, then goes back to the archive).
* Loading old Gmail in the background now stops at one year, so it never fills the app again. Change the window with `MAIL_KEEP_DAYS`.
* If the archive folder cannot be reached, nothing is removed from the app; it tries again 10 minutes later (look for "mail archive failed" in the log).
* If `db.json` can ever not be read, the app now keeps a copy (`db.json.broken-<time>`) instead of overwriting it.

## PO follow-up access (v3)
- Every signed-in team member sees **PO follow-up**: waiting list, add a PO / add many POs, DC + quotation files, Excel / PDF download.
- **Admin only:** the *ERP link* section (address + sign-in header), the *Reminder mails* cards, and **Companies shown**.
- **Companies shown** (admin): untick a company and its DCs disappear everywhere (page, Excel / PDF, reminder mails, adding POs) until the admin ticks it again. New companies show by default.
- A team member's *Email this DC* button only appears when the admin has a reminder for that company; it goes to the PO maker set there.

## ScanSheet is a backup only (Admin → Scan backup)

Entries saved in the ScanSheet app are **not orders**: they are never counted in Overview, Company report, Order tracking or PO follow-up. They are kept as a backup in two places:

* files in `data/scan-backup/` (on Synology this is the desk's `data` folder; change with `SCAN_BACKUP_DIR` in `.env`): `scan-YYYY-MM.csv` (opens in Excel) and `scan-all.jsonl` (full detail);
* the **Scan backup** page (administrator only), which checks every entry against your company sheets (by CN, or by DC + company): **Missing in sheet**, **CN differs**, **In sheet**. Use *Copy* (one row) or *Copy these rows* and paste into your sheet, or download Excel.

Entries that older versions stored as a "Scan sheet" company are moved to the backup automatically on the first start.

## Scan backup: auto-add missing entries to the company sheet (new)
Scan backup page: entries marked **Missing in sheet** are added to that company's OneDrive Excel sheet automatically.
* Every 5 minutes the desk re-reads each company sheet (so nothing is added twice), and entries still missing after 15 minutes
  (`SCAN_AUTOFIX_MIN` in `.env`, so the NAS has its own chance first) are added below the last row, matched to the sheet's own columns
  (DC, company, CN, courier, branch, date, entered by, image link ...). The next read shows them as *In sheet*.
* **Add missing to sheets now** button: same thing immediately. `SCAN_AUTOFIX=off` in `.env` switches it off.
* Needs Microsoft sign-in with edit permission (Order tracking page) and each company's sheet synced once. The company is matched by
  sheet name / organization. Sheets that are plain files on the server are not written (use Copy there). Errors show per entry.

## Daily report (end-of-day review)
Open **Daily report** in the left menu (administrator). Tick what you want in it, choose the day, then:
- **Show report** – read it on screen; **PDF** / **Excel** – download it; **Send now** – e-mail it.
- **Send automatically every day** – set a time and the address(es); the same ticked sections are e-mailed every day (needs Reports → Email settings or a Gmail mailbox).

Sections: Summary of the day · What customers asked (with who answered: AI, menu bot or a team member) · Tracking requests (found / not found) ·
Needs follow-up (customers still waiting) · Handed to the team · Team performance (replies, response time) · By organization · AI insights
(Gemini / Claude groups the day's questions into topics, problems and suggestions; one small request, review before acting).
Periods: today, yesterday, last 7 days or any date. Data is collected from this version onward (answers by AI vs menu bot and tracking / hand-off events are logged as they happen).
