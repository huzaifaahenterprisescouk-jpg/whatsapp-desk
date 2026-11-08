const fs = require('fs'), path = require('path');
const cfg = require('./config');

const DEFAULT_SETTINGS = {
  businessName: 'MR Enterprises',
  greeting: 'Welcome to {business}! 👋\nHow can we help you today?',
  guideText: 'Here is our quick guide:\n\n• Browse our catalogue and services at our website\n• Orders are processed within 24 hours\n• Delivery takes 2–5 working days\n\nNeed more help? Choose "Talk to our team" from the menu.',
  orgPrompt: 'Great! Please tell us the *name of your organization* and we will connect you with the person who looks after your account.',
  trackPrompt: 'Please send your *PO number*, *PR / REQ number* or *CN (tracking) number* (or the phone number used on the order).',
  handoffMessage: 'Thank you! 🙌 You are now connected with *{agent}*{org}. They will reply to you shortly.',
  noAgentMessage: 'Thank you! Our team has been notified and someone will reply to you very soon.',
  trackOrgPrompt: 'To track your order, please first tell us the *name of your organization* (for example: BANK AL FALAH).',
  courierLinks: require('./courier').DEFAULT_TEXT,
  trackOrgFirst: 'Please tell us your *organization name* first. After that, send your PO / P.R / CN number.',
  trackOrgNotFound: "We couldn't find an organization called *{q}*. Please type the organization name as it appears on your order, or type *4* to talk to our team.",
  notFoundOrg: "We couldn't find that organization in our records, so we've passed your chat to our team. Someone will reply shortly.",
  notFoundOrder: "We couldn't find an order matching *{q}*. Please check the ID and try again, or type *4* to talk to our team.",
  retailPrompt: 'Welcome, retail partner! 🏪\nPlease send your *shop account number*.\n\nNew shop? Type *NEW* and we will create an account number for you.',
  showTestPhone: '1',   // the "Test phone" button: the administrator can hide / show it (Settings)
  closedMessage: 'This chat has been marked as resolved. Send any message to start again. 😊',
  menu: {
    guide: 'Guide & information',
    org: "I'm from an organization",
    track: 'Track my order',
    human: 'Talk to our team',
    retail: 'Retail shop account',
    call: 'Call our team',
  },
};

let db = null, timer = null;

function seed() {
  const now = Date.now();
  db = {
    seq: 100,
    agents: [
      { id: 'a_admin', name: 'Admin', pin: cfg.adminPin, role: 'admin', color: '#0f766e', active: true },
    ],
    organizations: [],
    conversations: {},
    messages: [],
    orders: [],
    settings: DEFAULT_SETTINGS,
  };
  if (cfg.seedDemo) {
    db.agents.push(
      { id: 'a_sara', name: 'Sara Khan', pin: '1111', role: 'agent', color: '#7c3aed', active: true },
      { id: 'a_bilal', name: 'Bilal Ahmed', pin: '2222', role: 'agent', color: '#d97706', active: true },
      { id: 'a_hina', name: 'Hina Malik', pin: '3333', role: 'agent', color: '#db2777', active: true },
      { id: 'a_omar', name: 'Omar Farooq', pin: '4444', role: 'agent', color: '#2563eb', active: true },
    );
    db.organizations.push(
      { id: 'o_1', name: 'Hilton Hotels', aliases: ['hilton'], agentId: 'a_sara', backupAgentId: 'a_omar' },
      { id: 'o_2', name: 'Tesco', aliases: ['tesco plc', 'tesco stores'], agentId: 'a_bilal', backupAgentId: 'a_hina' },
      { id: 'o_3', name: 'NHS Supplies', aliases: ['nhs', 'national health service'], agentId: 'a_hina', backupAgentId: 'a_sara' },
      { id: 'o_4', name: 'Barclays', aliases: ['barclays bank'], agentId: 'a_omar', backupAgentId: 'a_bilal' },
    );
    const mk = (id, phone, name, org, status, courier, link, days, notes) => ({
      orderId: id, phone, customer: name, organization: org, status, courier, link,
      updated: new Date(now - days * 86400000).toISOString().slice(0, 10), notes,
    });
    db.orders.push(
      mk('ORD-1001', '923001234567', 'Ayesha Noor', 'Hilton Hotels', 'Shipped', 'DHL', 'https://example.com/track/1001', 1, 'Out for delivery tomorrow'),
      mk('ORD-1002', '923001234567', 'Ayesha Noor', 'Hilton Hotels', 'Processing', '', '', 0, 'Being packed'),
      mk('ORD-1003', '923451112223', 'Daniel Price', 'Tesco', 'Delivered', 'Royal Mail', 'https://example.com/track/1003', 4, 'Signed for by reception'),
      mk('ORD-1004', '923331239876', 'Fatima Zahra', 'NHS Supplies', 'Packed', 'TCS', '', 0, 'Ready for dispatch'),
      mk('ORD-1005', '923217770000', 'James Wright', 'Barclays', 'Confirmed', '', '', 0, ''),
    );
  }
  save(true);
}

function load() {
  fs.mkdirSync(path.dirname(cfg.dataFile), { recursive: true });
  if (fs.existsSync(cfg.dataFile)) {
    try { db = JSON.parse(fs.readFileSync(cfg.dataFile, 'utf8')); } catch (e) { console.error('db.json unreadable, starting fresh:', e.message); }
  }
  if (!db) seed();
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings, menu: { ...DEFAULT_SETTINGS.menu, ...(db.settings || {}).menu } };
  migrateSources();
  return db;
}

// Older versions had ONE sheet (db.sync + db.sheetCfg). Now there is a list of sheets, one per company.
function migrateSources() {
  if (Array.isArray(db.sources)) return;
  db.sources = []; db.orders = db.orders || [];
  const old = db.sync || {};
  if (old.url || db.orders.length) {
    const s = { id: 's_main', name: 'Main sheet', url: old.url || '', minutes: old.minutes || 5, cfg: db.sheetCfg || {}, lastSync: old.lastSync || 0, lastError: old.lastError || '', lastCount: old.lastCount || db.orders.length };
    db.sources.push(s);
    for (const o of db.orders) { o.src = s.id; o.company = s.name; }
  }
  delete db.sync; delete db.sheetCfg;
  save(true);
}

function save(now) {
  if (now) return fs.writeFileSync(cfg.dataFile, JSON.stringify(db, null, 2));
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFile(cfg.dataFile, JSON.stringify(db, null, 2), () => {}), 300);
}

const nextId = prefix => `${prefix}_${(db.seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

module.exports = { load, save, nextId, get db() { return db; }, DEFAULT_SETTINGS };
