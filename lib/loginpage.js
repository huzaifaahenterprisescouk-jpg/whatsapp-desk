// Sign-in page layout: everything on the login screen can be changed from Settings -> Login page.
// The layout is stored as one JSON string in settings.loginPage. This file holds the defaults and cleans
// whatever the browser sends (the sign-in page is public, so only plain text, colours, numbers and small images are accepted).

const DEFAULTS = {
  layout: 'left',            // which side the coloured panel is on: left | right
  split: 52,                 // width of the coloured panel in % (30-70)
  showHero: true,            // show the coloured panel at all
  heroAlign: 'center',       // where the headline block sits in the panel: top | center | bottom
  showLogo: true,
  brandName: 'WhatsApp Desk',
  brandImage: '',            // optional logo picture (data URL), replaces the chat icon
  headline: 'One WhatsApp number. Every customer with the right person.',
  headlineSize: 40,          // px
  text: 'Customers tell the bot which organization they are from, and the chat goes straight to the team member who looks after that account.',
  showPoints: true,
  points: [
    'Organization-based routing to your 4–6 team members',
    'Order tracking answered automatically from your Excel sheet',
    'Shared inbox with live updates and hand-over',
  ],
  footer: '{business} · Team workspace',
  heroFrom: '#0b2623', heroTo: '#0f766e', heroGlow: '#14b8a6', heroText: '#ffffff',
  heroAngle: 160,
  heroImage: '',             // optional background picture (data URL)
  heroImageDim: 45,          // % darkening on top of the picture so the text stays readable
  showRing: true,            // the big faint circle in the corner
  formAlignV: 'center',      // top | center | bottom
  formAlignH: 'center',      // left | center | right
  formWidth: 380,            // px
  panelBg: '', panelText: '', accent: '',   // '' = follow the app theme (light / dark)
  formTitle: 'Welcome back',
  formSub: 'Sign in with your username and password.',
  userLabel: 'Username', userPlaceholder: 'e.g. sara',
  passLabel: 'Password', passPlaceholder: 'Your password',
  buttonText: 'Sign in',
  showHint: true,
  hint: 'Forgot your username or password? Ask the administrator.',
};

const STR = { brandName: 60, headline: 160, text: 400, footer: 120, formTitle: 80, formSub: 160, userLabel: 40, userPlaceholder: 60, passLabel: 40, passPlaceholder: 60, buttonText: 40, hint: 200 };
const NUM = { split: [30, 70], headlineSize: [24, 72], heroAngle: [0, 360], heroImageDim: [0, 85], formWidth: [300, 560] };
const ENUM = { layout: ['left', 'right'], heroAlign: ['top', 'center', 'bottom'], formAlignV: ['top', 'center', 'bottom'], formAlignH: ['left', 'center', 'right'] };
const BOOL = ['showHero', 'showLogo', 'showPoints', 'showRing', 'showHint'];
const HEX = ['heroFrom', 'heroTo', 'heroGlow', 'heroText'], HEX_OPT = ['panelBg', 'panelText', 'accent'];
const IMG = ['brandImage', 'heroImage'], IMG_MAX = 700 * 1024;
const IMG_RE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

// Takes anything (a JSON string, an object, nothing) and returns a complete, safe layout object.
function clean(raw) {
  let r = raw;
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = {}; } }
  if (!r || typeof r !== 'object') r = {};
  const o = { ...DEFAULTS, points: [...DEFAULTS.points] };
  for (const [k, max] of Object.entries(STR)) if (typeof r[k] === 'string') o[k] = r[k].replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
  for (const [k, [lo, hi]] of Object.entries(NUM)) if (r[k] !== undefined && isFinite(+r[k])) o[k] = Math.min(hi, Math.max(lo, Math.round(+r[k])));
  for (const [k, list] of Object.entries(ENUM)) if (list.includes(r[k])) o[k] = r[k];
  for (const k of BOOL) if (typeof r[k] === 'boolean') o[k] = r[k];
  for (const k of HEX) if (typeof r[k] === 'string' && /^#[0-9a-f]{6}$/i.test(r[k])) o[k] = r[k].toLowerCase();
  for (const k of HEX_OPT) if (typeof r[k] === 'string') o[k] = /^#[0-9a-f]{6}$/i.test(r[k]) ? r[k].toLowerCase() : '';
  for (const k of IMG) if (typeof r[k] === 'string') o[k] = r[k] === '' || (r[k].length <= IMG_MAX && IMG_RE.test(r[k])) ? r[k] : o[k] === DEFAULTS[k] ? '' : o[k];
  if (Array.isArray(r.points)) o.points = r.points.filter(x => typeof x === 'string').map(x => x.slice(0, 140).trim()).filter(Boolean).slice(0, 8);
  return o;
}

module.exports = { DEFAULTS, clean };
