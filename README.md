# WhatsApp Desk

One WhatsApp Business number, a small team, and automatic routing by organization.

* A customer messages your number and gets a tap-to-choose menu.
* If they say which organization they are from ("I'm from Hilton"), the chat goes to the person who handles that organization (main person, then backup, then the least busy member).
* Customers can send an Order ID (or just ask "track my order") and the bot answers from your Excel sheet.
* Your team answers from a shared inbox with live updates, hand-over, and resolve/reopen.

Runs on **Node.js 20 or newer**. The desk itself needs no packages. Three small ones (`npm install`) are used only for linking your phone number with a QR code, and **ffmpeg** turns recorded voice messages into WhatsApp voice notes. The Docker image installs all of them for you.

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

## Social posting from TrendSEO Pro (new)

**Admin → Social posting.** Reads every product's SEO title, description, keywords and hashtags from the **TrendSEO Pro** plugin on your WordPress shop, writes a ready post for each platform, and posts it.

**Connect (once)**
1. In WordPress install **TrendSEO Pro 2.4.0** (the zip in this delivery). Open **TrendSEO Pro → WhatsApp Desk**: it shows your *site address* and a *Desk key*.
2. In the desk: **Social posting → Connection**, paste both, **Save & test**. All products are read, then re-read every 30 minutes (and with **Sync products**).

**Write & post.** Pick a product → the desk shows the SEO data and one editable post per platform (title, caption, hashtags, keywords) with *Copy post / title / hashtags / keywords* and *Open platform*. Tick the platforms, then **Post now**, or **Schedule** for later.

**How each platform is posted** (Platforms & automation tab, per platform)
* **Posted by your shop (TrendSEO)** – Facebook Page, Instagram, YouTube, and TikTok / Snapchat / Pinterest through the webhooks saved in *TrendSEO Pro → Auto Video & Social*. The shop uses its own logins (they never reach the desk) and posts the text you see in the desk, including your edits. Needs **TrendSEO Pro 2.4.1** or newer.
* **Webhook** – the desk sends exactly the text you see (JSON: platform, title, description, hashtags, keywords, link, price, image) to any URL: Zapier, Make, n8n, Buffer… That reaches TikTok, Snapchat, X, LinkedIn, Telegram, anything. **Add another platform** for any name.
* **WhatsApp** – picture + caption sent from your linked number to the chats / groups you tick, one by one with a pause (default 6 s). Only message people who expect it.
* **By hand** – copy buttons + the platform's page; marked as posted when you press Post.

**Facebook Page: pictures + video (new).** Under the product, the **Pictures & video** card lists the product's own pictures from WordPress (main picture ticked; tick the gallery ones too) and **Add pictures** uploads your own. Video: *No video*, *Slideshow made by your shop*, or *My own video* (MP4 / MOV, up to 150 MB). Pictures and video go into your shop's Media Library so Facebook can fetch them.
* Pictures only → one post (several pictures become one multi-picture post). Video only → one video post. **Both → two posts** on the Page (pictures, then the video) with the same text, because Facebook does not allow pictures and a video in one post.
* **Trending hashtags:** each platform shows the trending hashtags TrendSEO found for it (Google Trends, YouTube, TikTok Creative Center, search suggestions). Tap a hashtag to add or remove it in the post. Facebook posts start with 5.
* Your shop's PHP upload limit (`upload_max_filesize`, `post_max_size`) must be at least the size of your video; the desk shows the exact limit if it is too small.

**Continue with Facebook (new).** *Social posting → Connection → Facebook Page: sign in.* Click **Continue with Facebook**, sign in on Facebook, tick your Page (and the linked Instagram account is picked up too). The desk hands the connection to your shop (needs **TrendSEO Pro 2.4.2**), which does the posting; you never paste a token. One-time setup: create a free app at developers.facebook.com (type Business), add *Facebook Login*, paste the redirect address the desk shows into *Valid OAuth Redirect URIs*, and enter the App ID + App Secret and the desk's https address in the desk. Keep the app in *Development* mode: you, as its admin, can post to Pages you manage. The desk keeps only the app ID / secret and the Page name; the Page token is stored by your shop.

**Continue with Google (YouTube) (new).** Same idea under the Facebook card: create a free OAuth client in Google Cloud (enable YouTube Data API v3, redirect address shown in the desk), paste Client ID + secret once, then **Continue with Google**. Needs TrendSEO Pro 2.4.3. YouTube always needs a video.

**WhatsApp Channel & Status (new).** Two extra platforms, **WhatsApp Status** and **WhatsApp Channel**. Under *Platforms & automation → WhatsApp Channel & Status* paste your channel's link (WhatsApp → your channel → ⋮ → Share → Copy link) and press **Add channel**; you must be its owner or admin. Tick the platforms when you post: Status shows your ticked pictures (up to 5) or your video for 24 hours to your chats and you; the Channel gets the pictures / video + caption. Both need the **linked-phone** connection (not the Cloud API) and use unofficial WhatsApp access, so test with one product and keep volume low.

**Reels, Stories and a first comment on Facebook and Instagram (new).** Under the pictures card, choose **Post / Reel / Story** for each (Instagram's *Feed post* is the picture post). Reels need a video (yours, or the shop's vertical slideshow); Stories take a picture or a video; each goes out as its own post and shows on its own line in the result. A **first comment** (your link, by default) is added under the post / Reel, and you can list accounts to @mention (up to 10). Nobody can tag *everyone*: Facebook and Instagram treat mass tagging as spam. Needs TrendSEO Pro 2.4.4.

**Daily auto-posting.** Tick it, choose an hour, products per day and platforms: each day the desk posts the products that were posted longest ago (in stock, with a picture), with freshly written posts.

Notes: no tool can log in to TikTok / Snapchat for you without an official API or an automation service, so those two go through the shop's webhook, your own webhook, or by hand. The Desk key lets anyone read your SEO data and trigger posts, so keep it private; *Create a new key* in WordPress cuts the old one off.

## Product analytics (new)

Admin menu → **Product analytics**. One place to manage and track how every product performs. It reads everything from the
TrendSEO Pro plugin on your WordPress shop, so it uses the same connection as *Social posting* (site address + Desk key).

**Needs TrendSEO Pro 2.5.0 or newer** (adds the read-only `/analytics` feed to the desk bridge). Install the new plugin zip, then open
*Product analytics* and press **Refresh**.

What it shows (choose the last 7 / 30 / 90 days):

* **Overview**: product page views, orders, units, revenue, conversion, Google impressions / clicks / CTR; daily views and daily Google
  clicks charts; top products by revenue, views and Google clicks; TrendSEO health (Good / Needs work / Poor / Optimized by plugin);
  Facebook / Instagram / YouTube post totals.
* **Products**: one sortable, searchable table with views, orders, revenue, conversion, Google impressions / clicks / CTR / average
  position, main-keyword rank with trend arrow, YouTube rank and keyword, TrendSEO score and social views. Quick filters: *Selling*,
  *Views but no sales*, *Google page 1*, *Not ranking*, *Low SEO score*, *Has social posts*. Click a row to open the details: every Google
  search phrase with impressions / clicks / position, Google (Search Console and Rank #1 Booster) and Daraz / Amazon / TikTok /
  Instagram / Facebook rankings, video and optimisation status, and that product's social performance.
* **Google Search**: whole-site impressions, clicks, CTR and average position with daily charts, the top search phrases and the product
  pages that Google shows most (needs Google Search Console connected in TrendSEO Pro → Google Connect & Auto-SEO).
* **Social posts**: views, likes, comments, shares, saves and reach for every Facebook / Instagram / YouTube post the shop made.
* **Export CSV**: downloads the table as currently filtered and sorted.

The desk keeps a saved copy (re-read from the shop at most every 10 minutes), so the page opens instantly and still shows the last
numbers if the shop is briefly unreachable. **Refresh** asks the shop to pull fresh social numbers and Search Console data first.
Views are counted by TrendSEO Pro from the moment its analytics were activated; Search Console data is about 2 days behind. TikTok,
Snapchat, Pinterest and webhook posts cannot be measured, and nothing secret (keys, tokens) is sent through this feed.

## TikTok + Snapchat API settings and Flow AI prompts (new)

**Social posting → Connection** now has two more cards under Facebook and YouTube.

* **TikTok (Content Posting API).** Create an app at developers.tiktok.com, add *Login Kit* + *Content Posting API*, paste the **Client key** and **Client secret** here, add the shown Redirect URI in the app, verify your shop address under *URL properties*, then press **Continue with TikTok**. The TikTok row under *Platforms & automation* switches to *Posted by this desk through the TikTok API*: a product video (your own, e.g. made with Flow AI, chosen under *Pictures & video*) or, without a video, the ticked pictures as a photo post, go straight to TikTok. Choose *who can see posts* and *publish directly* or *send to my TikTok app as a draft*. Until TikTok audits your app, every post is private ("Only me"); that is TikTok's rule, not the desk's.
* **Snapchat.** Paste the **Client ID** and **Client secret** of your Snap OAuth app, add the Redirect URI, press **Continue with Snapchat**, then **Test connection**. Snapchat has no open posting API for normal accounts (only Snap-approved partners), so product posts to Snapchat still go through a webhook (Zapier / Make / n8n) or by hand until Snap approves your app; the saved login is ready for that day.
* The desk's own https address is shared by Facebook, YouTube, TikTok and Snapchat (enter it once, the others suggest it).

**Flow AI video prompts.** Open any product in *Social posting → Write & post*: the new **🎬 Flow AI video prompts** card writes six prompts from that product's own data (category, SEO keyword, description, features, hashtags): hero ad, in-use / lifestyle, detail showcase, viral UGC hook, 16:9 wide, and a 30-second 4-scene storyboard, in five styles (premium, lifestyle, viral, luxury, minimal), plus a voice-over line and caption. **Copy prompt → Open Google Flow → upload the product picture as the reference → generate**, then add the video under *Pictures & video* and post it. **Download prompts for ALL products (CSV)** exports every product at once. The same box also exists on every product page in WordPress (TrendSEO Pro 2.5.1).

