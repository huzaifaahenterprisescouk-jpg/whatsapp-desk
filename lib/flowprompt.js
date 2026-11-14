// Flow AI (Google Flow / Veo) video prompts, written from each product's own data (name, category, SEO keyword / description,
// features, hashtags). Works for any other text-to-video or image-to-video AI too (Veo, Sora, Kling, Runway, Meta AI, Hailuo...).
// Every prompt follows the order those models respond to best: SUBJECT -> ACTION / SHOT PLAN -> CAMERA -> LIGHT & STYLE -> AUDIO -> RULES.
// Nothing here calls the internet; it is plain, instant text building.

const cap = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// what kind of product is it? (decides the scene, the camera moves and the sound)
const KINDS = [
  ['jewelry', /\b(ring|necklace|bracelet|earring|pendant|jewel|jewellery|jewelry|bangle|anklet|chain)s?\b/i, {
    scene: 'on a dark velvet surface with soft bokeh sparkles, then worn on a model\'s hand / neck in a soft window-lit room', hero: 'slow macro orbit that makes the metal and stones catch the light', macro: 'the stones, the metal finish, the clasp and the engraving', use: 'being put on and admired in a mirror', light: 'soft spotlight with gentle sparkle highlights, deep elegant shadows', sound: 'soft delicate chime, quiet luxurious ambience',
  }],
  ['beauty', /\b(skin|serum|cream|lotion|makeup|lipstick|perfume|fragrance|beauty|hair|shampoo|oil|cleanser|mask|moistur|foundation|mascara|nail|attar|soap)\w*/i, {
    scene: 'on a clean marble / glass surface with fresh water droplets and soft petals or botanical props, then applied in a bright bathroom or vanity', hero: 'slow glide toward the bottle with a gentle product spin and a drop of texture falling', macro: 'the texture, the label area, the nozzle / cap and a swatch on skin', use: 'being applied to skin with a glowing, natural result', light: 'bright airy beauty lighting, soft glow, creamy highlights', sound: 'soft spa-like ambient music, a gentle water or pump sound',
  }],
  ['fashion', /\b(shirt|t-?shirt|dress|jacket|shoe|sneaker|heel|sandal|bag|handbag|backpack|wallet|belt|sunglass|glasses|cloth|wear|hoodie|jeans|trouser|abaya|kurta|shalwar|scarf|hijab|cap|hat|sock|coat|suit|kameez|lawn)\w*/i, {
    scene: 'on a clean studio backdrop, then worn by a model walking in a stylish urban street or bright minimal room', hero: 'slow-motion walk-in with the fabric moving naturally and a smooth turn', macro: 'the fabric texture, stitching, zip / buttons and the fit', use: 'being worn, with a quick confident spin to show the fit', light: 'fashion-editorial lighting, soft key light, gentle rim light', sound: 'modern upbeat instrumental beat, light fabric rustle',
  }],
  ['electronics', /\b(phone|charger|cable|earbud|earphone|headphone|speaker|camera|led|lamp|usb|bluetooth|power ?bank|laptop|keyboard|mouse|gadget|drone|smart|watch|tablet|monitor|router|battery|projector|tripod|mic|microphone|trimmer|shaver|fan|heater|iron|dryer)\w*/i, {
    scene: 'on a sleek dark desk with subtle neon / LED accents and a soft reflective surface, then used in a modern home or office', hero: 'dramatic push-in with a slow rotation and a light sweep across the surface', macro: 'the buttons, the ports, the glowing display / light and the build quality', use: 'being used for its main function, with a clear visible result', light: 'cinematic tech lighting, cool blue and warm accent rim lights, crisp reflections', sound: 'modern electronic ambient beat, soft UI click and power-up sounds',
  }],
  ['kitchen', /\b(kitchen|cook|pan|pot|knife|blender|chopper|cup|bottle|mug|flask|storage|organi[sz]er|container|home|decor|curtain|bed|towel|clean|vacuum|mop|brush|rack|shelf|bathroom|light|candle|pillow|blanket|mat|dinner|lunch|tray|jar)\w*/i, {
    scene: 'in a bright, tidy, modern home / kitchen with natural window light and fresh everyday props', hero: 'smooth tabletop glide with a gentle rotation so the whole product is visible', macro: 'the material, the handle / lid / mechanism and the capacity or size', use: 'being used to solve a small everyday problem and make life easier, shown start to finish', light: 'warm natural daylight, soft shadows, clean and inviting', sound: 'light cheerful acoustic ambience, realistic household sounds',
  }],
  ['fitness', /\b(fitness|gym|yoga|massag|brace|posture|support|health|supplement|exercise|knee|back|dumbbell|band|protein|sport|run|walk|bike|cycle|pain|relief|neck|shoulder|wrist|ankle)\w*/i, {
    scene: 'in a bright modern home gym / sunny outdoor park with an energetic feel', hero: 'dynamic low-angle push-in with a slight orbit and a confident reveal', macro: 'the material, the grip / strap / padding and the adjustable parts', use: 'being used during a real workout or daily routine, showing comfort and effect', light: 'bright energetic daylight, high contrast, punchy colors', sound: 'motivating upbeat beat, realistic movement sounds',
  }],
  ['kids', /\b(toy|kids?|baby|child|children|doll|game|puzzle|lego|stroller|diaper|school|crayon|plush)\w*/i, {
    scene: 'in a colourful playful kids\' room with soft natural light', hero: 'playful bouncy camera move with a happy reveal', macro: 'the bright colours, safe rounded edges and clever details', use: 'being played with happily (child kept natural, no close-up face needed, a smiling parent nearby)', light: 'bright cheerful high-key lighting', sound: 'playful light music, soft giggles in the background',
  }],
  ['tools', /\b(tool|drill|car|auto|motor|repair|garden|spanner|wrench|screw|saw|hammer|vehicle|tyre|tire|helmet|seat cover|dash|wiper|compressor|pump|welding)\w*/i, {
    scene: 'in a clean garage / workshop / driveway with realistic details', hero: 'strong, steady push-in with a slow rotation emphasising solid build', macro: 'the metal parts, grip, mechanism and finish', use: 'being used on a real task with a clear before / after result', light: 'strong natural-looking light with crisp contrast and subtle haze', sound: 'confident low-key beat, realistic tool and mechanical sounds',
  }],
  ['food', /\b(food|snack|tea|coffee|honey|spice|nuts?|dates|chocolate|biscuit|juice|drink|sauce|masala|rice|oil|sweet|dry fruit|organic)\w*/i, {
    scene: 'on a rustic wooden table with fresh ingredients, steam or splashes and warm morning light', hero: 'slow macro glide over the pack and the food with a satisfying pour / crumble', macro: 'the texture, freshness and the pack\'s details', use: 'being served and enjoyed with a happy first bite or sip', light: 'warm golden appetising light, shallow depth of field', sound: 'cosy acoustic music with crisp food sounds',
  }],
];
const GENERIC = {
  scene: 'on a clean, softly lit studio backdrop, then used in a realistic everyday setting that matches what it is for', hero: 'slow rotating hero shot with a smooth push-in', macro: 'the material, the finish and the most important details', use: 'being used for its main purpose by a real person, showing the benefit clearly', light: 'bright premium lighting, soft shadows, clean reflections', sound: 'modern upbeat instrumental music, soft realistic product sounds',
};
const kindOf = text => { for (const [k, re, o] of KINDS) if (re.test(text)) return { kind: k, ...o }; return { kind: 'general', ...GENERIC }; };

const STYLES = {
  premium: { label: 'Premium studio ad', look: 'high-end commercial look, ultra sharp, rich true-to-life colours, smooth cinematic camera moves' },
  lifestyle: { label: 'Lifestyle / real life', look: 'natural, authentic lifestyle look, soft handheld-stabilised camera, warm real-world colours' },
  viral: { label: 'Viral TikTok / Reels', look: 'fast, punchy vertical social-video look, bold saturated colours, quick satisfying cuts and a strong first second hook' },
  luxury: { label: 'Luxury cinematic', look: 'dark moody luxury cinematic look, shallow depth of field, slow elegant camera moves, deep contrast and gold / warm accents' },
  minimal: { label: 'Clean minimal', look: 'ultra clean minimal look, pure soft white / light-grey backdrop, gentle shadows, calm precise camera moves' },
};

// short, clean subject name + a few product facts from the data
function facts(prod, opt = {}) {
  const seo = prod.seo || {}, name = clean(prod.name || seo.title), kws = (seo.keywords || []).map(clean).filter(Boolean);
  const kw = clean(opt.keyword || kws[0] || ''), wc = s => s.split(/\s+/).filter(Boolean).length;
  const short = cap(kw && wc(kw) >= 1 && wc(kw) <= 6 ? kw : name, 70), cats = (prod.cats || []).map(clean).filter(Boolean);
  const descAll = clean(seo.desc || prod.description || ''), sentences = descAll.split(/(?<=[.!?])\s+|[•\n;|]+/).map(x => x.trim()).filter(x => x.length > 12);
  let features = (opt.features || []).map(clean).filter(Boolean);
  if (!features.length) features = sentences;
  features = [...new Set(features.map(f => cap(f.replace(/^[-•*\d.\s]+/, ''), 90).replace(/[.!?…\s]+$/, '')))].filter(Boolean).slice(0, 4);
  return { name, short, kw, kws, cats, desc: cap(descAll, 220), features, tags: (seo.hashtags || []).slice(0, 5), price: clean(prod.priceText || ''), kind: kindOf([name, kw, cats.join(' '), kws.join(' ')].join(' ')) };
}
const listOf = a => a.join('; ');
const up = s => s.charAt(0).toUpperCase() + s.slice(1);
const RULES = 'Keep the product\'s exact shape, colour, proportions, label and details identical to the reference image from the first frame to the last; no morphing, warping or extra parts. No on-screen text, captions or watermarks; no extra logos; natural people with the product, not their face, as the focus; clean natural hands with correct fingers; realistic physics.';

// build every prompt for one product. opt: { style, features, keyword }
function build(prod, opt = {}) {
  const style = STYLES[opt.style] ? opt.style : 'premium', st = STYLES[style], f = facts(prod, opt), k = f.kind;
  const subject = `${f.short}${f.desc ? ` (${f.desc.replace(/[.!?…\s]+$/, '')})` : ''}`;
  const details = f.features.length ? `Key details to show: ${listOf(f.features)}.` : '';
  const people = k.kind === 'jewelry' || k.kind === 'fashion' || k.kind === 'beauty' ? 'a natural-looking model' : 'a real person';
  const sound = `${k.sound}; no vocals`;
  const P = [];
  P.push({
    key: 'hero', title: 'Hero product ad', aspect: '9:16', seconds: 8, where: 'TikTok · Reels · Shorts · Snapchat Spotlight · Facebook',
    prompt: `An ${8}-second vertical (9:16) premium product commercial of ${subject}.\n` +
      `Shot plan: 0-3s) ${k.hero}, the product ${k.scene.split(', then')[0]}; 3-6s) macro close-up of ${k.macro}; 6-8s) clean final packshot of the product centred and sharp, slight push-in.\n` +
      `${details}\nCamera: smooth gimbal moves, shallow depth of field, rack focus between details.\nStyle & light: ${st.look}; ${k.light}.\nAudio: ${sound}.\n${RULES}`,
  });
  P.push({
    key: 'lifestyle', title: 'In-use / lifestyle', aspect: '9:16', seconds: 8, where: 'Reels · TikTok · Facebook · WhatsApp Status',
    prompt: `An 8-second vertical (9:16) lifestyle video showing ${subject} in real use.\n` +
      `Shot plan: 0-2s) quick eye-catching reveal of the product ${k.scene.includes(', then ') ? k.scene.split(', then ')[0] : 'in its natural setting'}; 2-6s) ${up(people)} shows the product ${k.use}, medium shot then close-up on the product doing its job; 6-8s) satisfied reaction and a clear final shot of the product.\n` +
      `${details}\nCamera: natural stabilised handheld feel, gentle push-ins.\nStyle & light: ${STYLES.lifestyle.look}; ${k.light}.\nAudio: ${sound}.\n${RULES}`,
  });
  P.push({
    key: 'macro', title: 'Detail & features showcase', aspect: '9:16', seconds: 8, where: 'Product page · Instagram · YouTube Shorts',
    prompt: `An 8-second vertical (9:16) macro showcase of ${subject}.\n` +
      `Shot plan: four quick, smooth shots of about 2 seconds each: 1) ${k.macro.split(', ')[0]}; 2) ${k.macro.split(', ')[1] || 'the main material and finish'}; 3) ${f.features[0] ? cap(f.features[0], 60) : 'the product being handled'}; 4) the whole product, slowly rotating to show every side.\n` +
      `Camera: extreme macro lens, slow slider moves, crisp focus pulls.\nStyle & light: ${st.look}; ${k.light}.\nAudio: ${sound}.\n${RULES}`,
  });
  P.push({
    key: 'viral', title: 'Viral hook (UGC style)', aspect: '9:16', seconds: 8, where: 'TikTok · Reels · Snapchat Spotlight',
    prompt: `An 8-second vertical (9:16) user-generated-content style video that hooks in the first second with ${subject}.\n` +
      `Shot plan: 0-1s) a surprising close-up of the product with a quick zoom; 1-5s) a fast, satisfying demonstration of the product ${k.use}; 5-8s) a happy reaction and the product held up toward the camera.\n` +
      `Camera: handheld phone-selfie feel, quick whip-pan transitions, energetic.\nStyle & light: ${STYLES.viral.look}; ${k.light}.\nAudio: trending-style upbeat beat, realistic product sounds, no vocals.\n${RULES}`,
  });
  P.push({
    key: 'wide', title: 'Wide 16:9 (YouTube / product page)', aspect: '16:9', seconds: 8, where: 'YouTube · your product page · Google video results',
    prompt: `An 8-second widescreen (16:9) cinematic product video of ${subject}.\n` +
      `Shot plan: 0-3s) establishing shot, ${k.scene}; 3-6s) ${k.hero}; 6-8s) hero packshot with generous empty space on the left for later text.\n` +
      `${details}\nCamera: smooth dolly and crane moves, shallow depth of field.\nStyle & light: ${st.look}; ${k.light}.\nAudio: ${sound}.\n${RULES}`,
  });
  // a longer film: four 8-second shots to chain in Flow (Scenebuilder / "Extend") for a ~30 second ad
  const sb = [
    ['Hook', `${k.hero}; the product ${k.scene.split(', then')[0]}`],
    ['Problem to solution', `the product ${k.use}, shown by ${people}`],
    ['Proof', `macro close-ups of ${k.macro}`],
    ['Call to action', 'clean final packshot, product centred, calm and confident, gentle push-in and a satisfying finish'],
  ];
  const board = sb.map((s, i) => `Scene ${i + 1} (8s, ${s[0]}): ${s[1]}.`).join('\n');
  P.push({
    key: 'story', title: '30-second storyboard (4 scenes)', aspect: '9:16', seconds: 32, where: 'Flow Scenebuilder / Extend · long Reels · YouTube Shorts',
    prompt: `A four-scene vertical (9:16) product film about ${subject}. Make each scene 8 seconds and let each scene continue directly from the last frame of the previous one, with the same product, same colours, same lighting and the same location logic.\n${board}\n${details}\nStyle & light: ${st.look}; ${k.light}.\nAudio: ${sound}.\n${RULES}`,
  });
  const vo = `${f.short}. ${f.features[0] ? cap(f.features[0], 80) + '.' : (f.desc ? cap(f.desc.split(/[.!?]/)[0], 90) + '.' : '')} ${f.price ? 'Now only ' + f.price + '. ' : ''}Order today.`.replace(/\s+/g, ' ').trim();
  const tips = [
    'In Flow: choose "Frames to Video" (or "Ingredients to Video") and upload the product photo as the reference, so the product stays exactly the same.',
    'Use the 9:16 prompts for TikTok / Reels / Shorts / Snapchat; the 16:9 prompt for YouTube and your product page.',
    'Make 2-3 variations of each prompt and keep the best. If the product shape drifts, shorten the prompt and repeat "same as reference image".',
    'AI video cannot spell reliably: add the price, name and "Order now" as text in your editor (CapCut, Canva) after generating.',
  ];
  return { product: { id: prod.id, name: f.name, keyword: f.kw, category: f.cats[0] || '', kind: k.kind }, style, styles: Object.fromEntries(Object.entries(STYLES).map(([a, b]) => [a, b.label])), prompts: P.map(p => ({ ...p, chars: p.prompt.length })), voiceover: vo, caption: cap([f.short, ...f.tags].join(' '), 150), tips };
}
module.exports = { build, STYLES, kindOf };
