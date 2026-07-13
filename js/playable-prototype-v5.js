'use strict';

/* ============================================================
   Vibe Coder Simulator — investor prototype
   Incident-led product strategy: specify, build, test, position,
   release, and read the market response. Consequences follow scope,
   evidence, timing, and technical choices — never a hidden virtue score.
   ============================================================ */

const $ = id => document.getElementById(id);

const ASSET = {
  oracle:'ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png',
  oracleIntro:'ChatGPT/R-assets/oracle/ORACLE-02/proto-art-07-task-introduction-v1.png',
  user47:'ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png',
  grandma:'ChatGPT/R-assets/cast/CAST-27/cast-27-grandmother-bust-v1.png',
  taskArt:'ChatGPT/UI-UX/cards/PROTO-ART-06/proto-art-06-task-card-illustrations-v1.png'
};

/* ---------- economy constants ---------- */
const REV_PER_USER_DAY = 0.09; // one active user contributes this much per day
const FIXED_BURN   = 105;      // rent + tools at midnight
const HIKE         = 1.50;     // Day 8 provider price rise ($/day)
const OPERATING_HOURS = 15;    // 09:00–24:00; daily totals accrue evenly while time passes
const REFUND_SHARE = 0.4;      // slice of exposure billed the next morning

const fmtDay = n => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(2)}/day`;
const money = n => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;
const plainMoney = n => `$${n.toFixed(2)}`;
const displayFeature = value => value ? value.charAt(0).toUpperCase()+value.slice(1) : '';
const isNewProduct = t => /^New app\b/i.test(t.type);
const productScope = t => `${isNewProduct(t)?'New product':'Existing product'} · ${t.app}`;
const taskButtonLabel = t => isNewProduct(t)?`Prototype ${t.app}`:`Work on this ${t.app} problem`;

const ACTIVITIES = {
  workout:{id:'workout',name:'Work out',place:'Neighborhood gym',hours:1,cash:8,effect:'Restore 2 Focus immediately.',focus:2},
  meetup:{id:'meetup',name:'Community demo night',place:'Founder Commons',hours:1.5,cash:20,effect:'A new contact adds $40 to a successful customer presentation.',eventBonus:40},
  class:{id:'class',name:'Product systems class',place:'Community classroom',hours:2,cash:40,effect:'A test-first checklist prevents the Standard build’s implementation bug on Day 8.'},
  photo:{id:'photo',name:'Photography walk',place:'Market streets',hours:1.5,cash:15,effect:'Adds a changing-light edge case to the next test run.',photoTest:true},
  grandma:{id:'grandma',name:'Call Grandma',place:'Phone call',hours:1,cash:0,effect:'Her read-back insight adds 4 users to an evidence-matched ClearRead launch.',launchUsers:4}
};

/* ---------- seeded RNG (real randomness, reproducible per build) ---------- */
function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- Day 7 tasks: staged plain-language Q&A ---------- */
/* Each question: the plain wording of one instruction slot.
   Options: one that covers the behavior, one that sounds nice but doesn't,
   one that overpromises. Only what you actually ask for gets built. */
const QUESTIONS = [
  {slot:'goal',     q:'What should the app do?',            jargon:'Goal'},
  {slot:'context',  q:'When does the problem happen?',      jargon:'User / context'},
  {slot:'success',  q:'How will we know it worked?',        jargon:'Success check'},
  {slot:'guardrail',q:'What must it never do?',             jargon:'Guardrail'}
];

const DAY7_TASKS = {
  glare:{
    id:'glare', app:'ClearRead', art:0,
    person:'USER_0047\u2019s grandma', type:'Read-aloud app \u00b7 84 users',
    title:'Stop wrong reads on shiny labels',
    problem:'Last night ClearRead read a glossy medicine label wrong, out loud, with total confidence. She almost took a double dose.',
    takes:'Answer four questions \u2014 every answer is a real product decision \u00b7 about 3\u20134 hours to build and test.',
    ignoreUsers:7,
    ignoreLine:'7 users who hit shiny labels today will cancel tomorrow.',
    caseName:'the shiny-label case',
    payoffLine:'Garage Demo Night pays $180 for a working demo before judging closes at 17:00.',
    eventName:'Garage Demo Night', deadline:17, sponsor:180, hypeOdds:0.5,
    questions:{goal:'What result should ClearRead produce from a readable label?',context:'Which difficult photo condition should this build target?',success:'What should happen when ClearRead cannot complete the read?',guardrail:'What boundary should the read-aloud flow enforce?'},
    answers:{
      goal:[
        {id:'read',   text:'read the label aloud, and say so when it cannot',
         note:'the core job, stated plainly', fit:1, users:4, fragile:0,
         test:{name:'Clear paper label', detail:'The everyday read-aloud works as specced.'}},
        {id:'fast',   text:'read labels twice as fast as today',
         note:'users love speed \u2014 this says nothing about being right', fit:0, users:5, fragile:0,
         test:{name:'Speed benchmark', detail:'A clear label reads in under a second.'}},
        {id:'enhance',text:'read anything \u2014 even shiny or damaged \u2014 by cleaning the photo first',
         note:'the ambitious version; more moving parts to build', fit:2, users:6, fragile:2,
         test:{name:'Enhancement pipeline', detail:'A bad photo is cleaned before reading.'}}
      ],
      context:[
        {id:'glare',  text:'when light glares off a shiny or curved label',
         note:'aims the build directly at last night', fit:2, users:2, fragile:0,
         test:{name:'Grandma\u2019s glossy label', detail:'The exact photo from last night.'}},
        {id:'dim',    text:'when the room is dim or the hand is shaky',
         note:'a real problem \u2014 a different one', fit:1, users:3, fragile:0,
         test:{name:'Dim kitchen photo', detail:'A blurry evening scan reads correctly.'}},
        {id:'always', text:'for every photo, in every condition',
         note:'wide and unfocused \u2014 harder to build well', fit:1, users:3, fragile:1,
         test:{name:'Torture sheet', detail:'A pile of terrible photos, end to end.'}}
      ],
      success:[
        {id:'retake', text:'it asks for another photo instead of guessing',
         note:'grandma gets a clear recovery step and tries again', fit:2, users:2, fragile:0,
         test:{name:'Retake request', detail:'When it cannot read, it asks for another shot.'}},
        {id:'refuse', text:'it refuses shiny labels outright and says why',
         note:'conservative and predictable — some scans will not happen', fit:2, users:-2, fragile:0,
         test:{name:'Refusal message', detail:'A shiny label produces a clear, spoken no.'}},
        {id:'stars',  text:'save each scan and its confidence for later review',
         note:'creates a review trail but does not change the live response', fit:1, users:1, fragile:0,
         test:{name:'Review trail', detail:'Each scan stores its result and confidence.'}}
      ],
      guardrail:[
        {id:'warn',   text:'never read a guess aloud as if it were sure',
         note:'the rule that was missing last night', fit:2, users:2, fragile:0,
         test:{name:'Curved bottle, uncertain read', detail:'Low confidence warns instead of guessing.'}},
        {id:'polite', text:'always sound calm and kind, even when failing',
         note:'matters to people \u2014 does not stop a wrong dose', fit:0, users:1, fragile:0,
         test:{name:'Tone check', detail:'The voice stays warm through an error.'}},
        {id:'gate',   text:'below 90% sure, stop and say so',
         note:'strict \u2014 a few valid reads will be blocked too', fit:2, users:-1, fragile:1,
         test:{name:'Confidence gate', detail:'Low-confidence reads are blocked, with a reason.'}}
      ]
    },
    honestCopy:'ClearRead handles shiny labels now — no more confident guessing.',
    hypeCopy:'ClearRead now reads any text, anywhere. Perfectly.',
    untested:['handwriting','damaged labels','other languages','low light'],
    honest:{users:12, ai:0.45},
    hype:{users:26, ai:1.88, cash:35, exposure:75},
    hypeVictim:'Marisol P., who tried a handwritten prescription because your post said \u201cany text, anywhere\u201d'
  },
  offline:{
    id:'offline', app:'ClearRead', art:1,
    person:'the Westside clinic', type:'Read-aloud app \u00b7 84 users',
    title:'Make it work without internet',
    problem:'The clinic\u2019s wifi drops during appointments. Fourteen patients cannot rely on ClearRead exactly when they need it.',
    takes:'Answer four questions \u2014 every answer is a real product decision \u00b7 about 4 hours.',
    ignoreUsers:4,
    ignoreLine:'4 clinic users give up on the app tomorrow and the pilot stays closed.',
    caseName:'the dropped-connection case',
    payoffLine:'The clinic pays $120 for a build that survives airplane mode before its 15:30 review.',
    eventName:'Clinic connectivity review', deadline:15.5, sponsor:120, hypeOdds:0.45,
    questions:{goal:'How should ClearRead work when the connection is unavailable?',context:'Which connection failure should this build target?',success:'What result should the offline flow guarantee?',guardrail:'What should happen when offline information may be stale?'},
    answers:{
      goal:[
        {id:'local', text:'read labels with a small model on the phone itself',
         note:'works with no connection at all', fit:2, users:3, fragile:1,
         test:{name:'Airplane-mode scan', detail:'A label reads with the network off.'}},
        {id:'cachefirst', text:'remember every label it has seen and reuse the answer',
         note:'instant for repeat labels; new labels still need signal', fit:1, users:3, fragile:0,
         test:{name:'Repeat-label recall', detail:'A previously seen label reads offline.'}},
        {id:'hybrid', text:'try the cloud, fall back to the phone when it drops',
         note:'best of both; two systems to keep synchronized', fit:2, users:4, fragile:2,
         test:{name:'Mid-scan handover', detail:'The connection dies mid-scan; the phone finishes.'}}
      ],
      context:[
        {id:'drops', text:'when the connection drops mid-appointment',
         note:'the clinic\u2019s exact situation', fit:2, users:2, fragile:0,
         test:{name:'Appointment dropout', detail:'A scan completes through a mid-visit outage.'}},
        {id:'roam',  text:'when someone is travelling or underground',
         note:'a real segment \u2014 not the clinic\u2019s', fit:1, users:3, fragile:0,
         test:{name:'Subway test', detail:'A scan completes with zero bars.'}},
        {id:'anywhere', text:'anywhere, online or off, no difference ever',
         note:'a big claim to keep; wide surface', fit:1, users:3, fragile:1,
         test:{name:'Parity sweep', detail:'Online and offline answers match.'}}
      ],
      success:[
        {id:'queue', text:'offline scans finish and save, nothing is lost',
         note:'provable in airplane mode', fit:2, users:2, fragile:0,
         test:{name:'Offline queue', detail:'Offline scans complete and persist.'}},
        {id:'notify', text:'it tells the patient exactly what it can and cannot do right now',
         note:'clear status; scans may still wait', fit:1, users:1, fragile:0,
         test:{name:'Status banner', detail:'Offline mode announces itself clearly.'}},
        {id:'renew', text:'save a completion record for the clinic\u2019s pilot report',
         note:'measures completion without changing how the scan works', fit:1, users:1, fragile:0,
         test:{name:'Pilot completion record', detail:'Every offline completion appears in the clinic report.'}}
      ],
      guardrail:[
        {id:'stale', text:'warn when its offline data is old',
         note:'stale medical data is the hidden danger', fit:2, users:1, fragile:0,
         test:{name:'Stale-data warning', detail:'Old downloaded data announces itself.'}},
        {id:'quiet', text:'never interrupt an appointment with warnings',
         note:'calm rooms \u2014 and silent failure modes', fit:0, users:2, fragile:0,
         test:{name:'Quiet mode', detail:'No popups during an active appointment.'}},
        {id:'block', text:'refuse to answer from data older than a week',
         note:'strict safety; some offline reads will refuse', fit:2, users:-1, fragile:1,
         test:{name:'Freshness gate', detail:'Week-old data refuses with a reason.'}}
      ]
    },
    honestCopy:'ClearRead keeps working when the wifi does not \u2014 and tells you what it knows.',
    hypeCopy:'Perfect reading, online or off, forever.',
    untested:['first-time downloads','rare scripts','storage full','months without sync'],
    honest:{users:8, ai:0.30},
    hype:{users:18, ai:1.35, cash:25, exposure:65},
    hypeVictim:'a rural user whose first-ever download failed after your post promised \u201conline or off, forever\u201d'
  },
  share:{
    id:'share', app:'ClearRead', art:2,
    person:'carers of current users', type:'Read-aloud app \u00b7 84 users',
    title:'Share a readable result with a carer',
    problem:'Users can hear a result but cannot send a readable copy to the person who helps them. Photos of medicine labels are private.',
    takes:'Answer four questions \u2014 every answer is a real product decision \u00b7 about 3 hours.',
    ignoreUsers:0,
    ignoreLine:'No one cancels tomorrow, but word-of-mouth growth stays flat.',
    caseName:'the carer-sharing case',
    payoffLine:'An accessibility newsletter pays $90 to feature a private, readable share before its 18:00 deadline.',
    eventName:'Newsletter feature review', deadline:18, sponsor:90, hypeOdds:0.55,
    questions:{goal:'What should the user be able to share with a carer?',context:'When should ClearRead offer or send the share?',success:'What privacy behavior should the test verify?',guardrail:'What recipient rule should the share flow enforce?'},
    answers:{
      goal:[
        {id:'card',  text:'export a large-type card of the result',
         note:'readable by the carer, printable at the pharmacy', fit:2, users:3, fragile:0,
         test:{name:'Readable result card', detail:'Large type carries the result.'}},
        {id:'voice', text:'send a voice recording of the result',
         note:'personal and quick; not skimmable later', fit:1, users:2, fragile:0,
         test:{name:'Voice note export', detail:'A clear recording sends and plays.'}},
        {id:'live',  text:'let the carer watch scans live from their own phone',
         note:'the ambitious version \u2014 a second app surface to build', fit:2, users:4, fragile:2,
         test:{name:'Live session', detail:'A carer sees a scan happen in real time.'}}
      ],
      context:[
        {id:'send',  text:'when a user chooses to send one result to their carer',
         note:'the actual moment of use', fit:2, users:2, fragile:0,
         test:{name:'Send-to-carer flow', detail:'Sharing happens from a finished scan.'}},
        {id:'weekly',text:'as a weekly digest of important scans',
         note:'lower friction; less timely', fit:1, users:2, fragile:0,
         test:{name:'Digest assembly', detail:'A week of scans becomes one readable summary.'}},
        {id:'scan',  text:'automatically, every time any scan happens',
         note:'zero effort \u2014 and private scans leave by default', fit:1, users:3, fragile:1,
         test:{name:'Auto-share pipe', detail:'A completed scan reaches the carer unprompted.'}}
      ],
      success:[
        {id:'redact',text:'the shared card never includes the original photo',
         note:'privacy you can test', fit:2, users:2, fragile:0,
         test:{name:'Photo stays private', detail:'The original label photo is not in the share.'}},
        {id:'expire',text:'shared results disappear after 48 hours',
         note:'limits the damage of a wrong send', fit:1, users:1, fragile:1,
         test:{name:'Expiry sweep', detail:'A shared card is gone two days later.'}},
        {id:'pretty',text:'apply a large-type visual template to every shared card',
         note:'consistent and testable, though it does not limit photo sharing', fit:1, users:1, fragile:0,
         test:{name:'Large-type template', detail:'Every shared result uses the readable template.'}}
      ],
      guardrail:[
        {id:'confirm',text:'always confirm who receives it before sending',
         note:'wrong-recipient is the disaster case', fit:2, users:1, fragile:0,
         test:{name:'Recipient confirmed', detail:'No silent sends to the wrong person.'}},
        {id:'contacts',text:'only ever send to one saved, verified carer',
         note:'the safest possible pipe \u2014 and the least flexible', fit:2, users:-1, fragile:0,
         test:{name:'Single-carer lock', detail:'Sends to anyone else are impossible.'}},
        {id:'fastsend',text:'send to the selected contact without asking for confirmation again',
         note:'faster for repeat use, with greater wrong-recipient exposure', fit:1, users:2, fragile:1,
         test:{name:'Repeat-contact send', detail:'A selected contact receives the share without a second prompt.'}}
      ]
    },
    honestCopy:'Share a large-type result card \u2014 without ever sharing the label photo.',
    hypeCopy:'One tap shares everything with everyone.',
    untested:['group chats','revoked access','screenshots','wrong recipients'],
    honest:{users:10, ai:0.38},
    hype:{users:24, ai:1.65, cash:30, exposure:80},
    hypeVictim:'a user whose label photo landed in a family group chat after your post said \u201cshare everything with everyone\u201d'
  }
};

const DAY8_TASKS = {
  bill:{
    id:'bill', app:'ClearRead', art:3,
    person:'the operating budget', type:'Read-aloud app',
    title:'Reduce ClearRead’s daily AI cost',
    problem:'ORACLE Corp raised its prices overnight. ClearRead now costs $1.50 more per day to operate.',
    takes:'4 behaviors · systems work, not magic · about 4 hours.',
    ignoreUsers:0,
    ignoreLine:'Nothing breaks — the company just keeps paying the higher bill every day.',
    payoffLine:'A pharmacy chain pays $140 for a fast, cheap, accurate pilot at its 15:00 cost review.',
    eventName:'Pharmacy cost review', deadline:15, sponsor:140,
    questions:{goal:'What must stay unchanged while daily AI cost falls?',context:'Where should the build remove unnecessary AI work?',success:'How should repeated work be reused?',guardrail:'When should ClearRead use the more expensive model?'},
    chips:[
      {id:'preserve',text:'keep read-aloud accuracy exactly as it is',slot:'goal',required:true},
      {id:'resize',  text:'shrink photos before uploading them',slot:'context',required:true},
      {id:'cache',   text:'remember repeated work and reuse the result',slot:'success',required:true},
      {id:'fallback',text:'use a cheaper model first, escalate only when unsure',slot:'guardrail',required:true}
    ],
    tests:[
      {slot:'goal',     name:'Accuracy unchanged',      detail:'Optimization must not make reading worse.'},
      {slot:'context',  name:'Big photo upload',        detail:'A huge photo gets shrunk before it costs money.'},
      {slot:'success',  name:'Repeated work is reused', detail:'The same label can reuse a saved result.'},
      {slot:'guardrail',name:'Cheap-first escalation',  detail:'Easy labels stay on the cheap model.'}
    ],
    honestCopy:'Same reading, same warnings — the app just runs leaner now.',
    hypeCopy:'Instant, private, perfect scans.',
    untested:['peak traffic','rare languages','provider outage'],
    honest:{users:6,  ai:-1.13},
    hype:{users:16, ai:-0.45, cash:25, exposure:60},
    hypeVictim:'a user who believed “instant, private, perfect” and hit a slow rare-language scan'
  },
  support:{
    id:'support', app:'ClearRead', art:4,
    person:'a user with a handwritten prescription', type:'Read-aloud app',
    title:'Route handwriting safely',
    problem:'A user sent a handwritten label. Today the app correctly admits it can’t read it — she’s asking whether it ever will.',
    takes:'4 behaviors · the reliable route may use a human reviewer · about 3–4 hours.',
    ignoreUsers:0,
    ignoreLine:'The ticket stays open. No one cancels tomorrow, but she is still waiting.',
    payoffLine:'An accessibility partner pays $110 if handwriting routes safely before its 18:30 review.',
    eventName:'Accessibility partner review', deadline:18.5, sponsor:110,
    questions:{goal:'What should ClearRead recognize before attempting a read?',context:'Which existing behavior must this change leave untouched?',success:'What path should appear when the app remains unsure?',guardrail:'What permission is required before a photo leaves the phone?'},
    chips:[
      {id:'hand',    text:'recognize when a label is handwritten',slot:'goal',required:true},
      {id:'keep',    text:'keep printed-text reading untouched',slot:'context',required:true},
      {id:'human',   text:'offer to send uncertain labels to a person',slot:'success',required:true},
      {id:'consent', text:'ask permission before sharing any photo',slot:'guardrail',required:true}
    ],
    tests:[
      {slot:'goal',     name:'Handwriting detected',   detail:'The app notices the input changed category.'},
      {slot:'context',  name:'Printed text regression',detail:'Existing users keep the working feature.'},
      {slot:'success',  name:'Human hand-off offered', detail:'Uncertain labels can reach a person.'},
      {slot:'guardrail',name:'Consent before sharing', detail:'No photo leaves the phone unasked.'}
    ],
    honestCopy:'ClearRead now spots handwriting and can pass it to a human reviewer — with your permission.',
    hypeCopy:'Reads every handwriting style. Instantly.',
    untested:['cursive','medical shorthand','no reviewer available'],
    honest:{users:9,  ai:0.30},
    hype:{users:22, ai:1.50, cash:30, exposure:90},
    hypeVictim:'a nurse who sent cursive medical shorthand because your post said “every handwriting style, instantly”'
  },
  receipt:{
    id:'receipt', app:'ReceiptSnap', art:5,
    person:'a small-business owner', type:'New app · expense scanner',
    title:'Prototype a second app',
    problem:'A shop owner wants receipt totals without typing them in. A brand-new app — no existing users to protect, none to gain from ClearRead.',
    takes:'4 behaviors · a new app has no safety net · about 4–5 hours.',
    ignoreUsers:0,
    ignoreLine:'Nothing breaks. Choosing this leaves today’s ClearRead work for another day.',
    payoffLine:'A shop owner pays a $160 design deposit if the first slice works before closing at 20:00.',
    eventName:'Shop-owner design call', deadline:20, sponsor:160,
    questions:{goal:'Which values should ReceiptSnap extract?',context:'Which difficult receipt should the first build handle?',success:'What validation should reject an impossible result?',guardrail:'What should happen when a number is uncertain?'},
    chips:[
      {id:'fields', text:'pull the merchant, total, and tax off a receipt',slot:'goal',required:true},
      {id:'paper',  text:'cope with crumpled, faded thermal paper',slot:'context',required:true},
      {id:'date',   text:'check the purchase date is a real date',slot:'success',required:true},
      {id:'flag',   text:'flag any field it is not sure about — never invent a number',slot:'guardrail',required:true}
    ],
    tests:[
      {slot:'goal',     name:'Fields extracted',   detail:'Merchant, total, and tax come off a clear receipt.'},
      {slot:'context',  name:'Crumpled thermal paper',detail:'A bad receipt still yields what it can.'},
      {slot:'success',  name:'Date validation',    detail:'“32 Jan” is rejected, not booked.'},
      {slot:'guardrail',name:'No invented numbers',detail:'Uncertain fields are flagged, never guessed.'}
    ],
    honestCopy:'ReceiptSnap reads clear receipts and flags anything it isn’t sure about.',
    hypeCopy:'Your bookkeeper, replaced in one photo.',
    untested:['foreign tax','multi-page invoices','refunds','accounting exports'],
    honest:{users:7,  ai:0.38},
    hype:{users:25, ai:2.10, cash:45, exposure:110},
    hypeVictim:'a shop owner who fired her part-time bookkeeper after your post — then hit a multi-page invoice'
  }
};

const SLOT_QUESTION = {goal:'What should it do?',context:'When does it happen?',success:'How do we know it worked?',guardrail:'What must it never do?'};
const questionFor = (t,slot) => t?.questions?.[slot] || QUESTIONS.find(q=>q.slot===slot)?.q || SLOT_QUESTION[slot];

/* ============================================================
   State
   ============================================================ */
const initialState = () => ({
  day:7, time:9, cash:560, credits:620, focus:4, users:84,
  aiDaily:2.25,
  // pipeline
  sceneQueue:[], scenesSeen:{},
  morningDone:false, selectedTaskId:'', inviteShown:false, oracleIntroDone:false,
  answers:{}, qIndex:0,                      // Day 7 staged Q&A
  selected:[], reviewedSlots:[], // Day 8 uses the same four-question interview
  build:null, tested:false, testResults:[], version:0,
  shipped:false, copy:'', copyType:'', issueResolved:false,pendingLaunch:null,launchSettlement:null,
  demoAttended:false, demoResult:'',
  activityIds:[], activitySpend:0,
  // consequences ledger
  exposures:[], trustPenalty:0, fitAtShip:'closed', _blewOvernight:false,
  // day accounting
  dayStartCash:560, dayStartAiDaily:2.25, opRevenue:0, opAI:0, sponsorCash:0, preorderCash:0,
  coffeeSpend:0, purchaseSpend:0, fixedSpend:0,
  usersLost:0, refundPaid:0, settled:false, gameOver:false,
  previousCopy:'', previousCopyType:'', previousTaskId:'',
  day7Ignored:false, day7IgnoredUsers:0,
  recordTab:'products',
  pos:{x:50,y:70}, nearest:null, facing:'front'
});

let S = initialState();
let toastTimer = null;
let spriteMode = 'idle';
let spriteFrame = 0;
let spriteTimer = null;

function spritePath(mode=spriteMode, facing=S.facing, frame=spriteFrame){
  return `assets/generated/sprites/PC-01/frames/${mode}/${facing}-${String(frame+1).padStart(2,'0')}.png`;
}
function paintPlayerSprite(){const player=$('player');if(player)player.style.backgroundImage=`url('${spritePath()}')`;}
function startPlayerAnimation(mode, force=false){
  if(!force&&spriteMode===mode&&spriteTimer)return;
  spriteMode=mode;spriteFrame=0;clearInterval(spriteTimer);paintPlayerSprite();
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)return;
  const delay=mode==='walk'?120:mode==='interact'?210:340;
  spriteTimer=setInterval(()=>{spriteFrame=(spriteFrame+1)%4;paintPlayerSprite();},delay);
}

/* ---------- derived ---------- */
const day7 = () => S.day === 7;
const taskSet = () => day7() ? DAY7_TASKS : DAY8_TASKS;
const task = () => taskSet()[S.selectedTaskId] || null;
const dailyRevenue = () => S.users * REV_PER_USER_DAY;
const dailyProductResult = () => dailyRevenue() - S.aiDaily;
const projectedDayChange = () => dailyProductResult() - FIXED_BURN;
const runway = () => S.cash / Math.max(1, FIXED_BURN - dailyProductResult());
const fiveDayCashProjection = (cash,dailyNet) => cash + dailyNet*5;
const expTotal = () => S.exposures.reduce((n,e)=>n+e.amount,0);
const timeText = () => {const h=Math.floor(S.time), m=Math.round((S.time-h)*60);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;};
const clockText = value => {const h=Math.floor(value),m=Math.round((value-h)*60);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;};
const eventDeadline = t => t?.deadline ?? 17;
const eventName = t => t?.eventName || 'Demo Night';
const eventOpen = t => S.time+1<=eventDeadline(t);
const aiDailyAfter = delta => Math.max(0.60,S.aiDaily+delta);
const aiDailyDifference = delta => aiDailyAfter(delta)-S.aiDaily;
const operatingCashFor = hours => dailyProductResult()*(hours/OPERATING_HOURS);
const activities = () => (S.activityIds||[]).map(id=>ACTIVITIES[id]).filter(Boolean);
const didActivity = id => (S.activityIds||[]).includes(id);
const activityEventBonus = () => activities().reduce((sum,a)=>sum+(a.eventBonus||0),0);
const activityLaunchUsers = (type,t) => type==='honest'&&t?.app==='ClearRead' ? activities().reduce((sum,a)=>sum+(a.launchUsers||0),0) : 0;

function advanceTime(hours){
  const actual = Math.max(0, Math.min(hours, 24 - S.time));
  const fraction = actual / OPERATING_HOURS;
  const rev = dailyRevenue() * fraction, ai = S.aiDaily * fraction;
  S.opRevenue += rev; S.opAI += ai; S.cash += rev - ai; S.time += actual;
}

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}

/* ============================================================
   Scene system (visual-novel beats)
   ============================================================ */
function showScene(spec){
  // spec: {cls, art, artAlt, pages:[{speaker,title,html,aside}], doneLabel, onDone}
  let page = 0;
  const renderPage = () => {
    const p = spec.pages[page];
    const last = page === spec.pages.length - 1;
    openModal(`<div class="scene ${spec.cls||''}">
      ${spec.art?`<img class="scene-character" src="${spec.art}" alt="${spec.artAlt||''}">`:''}
      <div class="scene-box ${spec.art?'':'wide'}">
        <div class="speaker">${p.speaker||''}</div>
        ${p.title?`<h2 id="modal-title">${p.title}</h2>`:''}
        ${p.html}
        ${p.aside?`<div class="aside">${p.aside}</div>`:''}
        <div class="modal-actions">
          <button class="btn primary" id="scene-next">${last?(spec.doneLabel||'Continue'):'Continue ▸'}</button>
        </div>
      </div>
    </div>`, false);
    $('scene-next').onclick = () => {
      if (last){ closeModal(); if (spec.onDone) spec.onDone(); }
      else { page += 1; renderPage(); }
    };
  };
  renderPage();
}

/* ============================================================
   Modal plumbing + world (unchanged bones from v3)
   ============================================================ */
// Interaction points sit beside each label so the Founder never covers UI text.
const stationPositions = {oracle:{x:34,y:69,label:'ORACLE product studio'},test:{x:62,y:51,label:'test bench'},activity:{x:34,y:82,label:'outside activity map'},coffee:{x:48,y:78,label:'coffee bar'},door:{x:48,y:88,label:'event / release door'}};
// Collision follows the visible floor footprint of each object, using the
// Founder's common foot anchor. Separate shapes preserve the real strips of
// floor between the plant, sofa and coffee table instead of inventing one
// large invisible wall around the whole corner.
const collisionShapes = [
  {x1:4,y1:0,x2:55,y2:31,label:'left wall shelving'},
  {x1:6,y1:28,x2:55,y2:49,label:'left desks'},
  {x1:19,y1:44,x2:37,y2:67,label:'left chair'},
  {x1:39,y1:43,x2:55,y2:64,label:'left drawers'},
  {x1:70,y1:0,x2:100,y2:31,label:'right wall shelving'},
  {x1:70,y1:28,x2:100,y2:49,label:'right desk'},
  {x1:79,y1:43,x2:100,y2:67,label:'right chair'},
  {x1:4,y1:57,x2:24,y2:94,label:'plant'},
  // The sofa needs a small visual clearance around its painted silhouette: using
  // only the foot point let the Founder's body appear to stand on the cushions.
  {x1:58,y1:58,x2:100,y2:84,label:'sofa'},
  {x1:65,y1:82,x2:99,y2:97,label:'coffee table'}
];
const collisionAt=(x,y)=>collisionShapes.find(r=>x>=r.x1&&x<=r.x2&&y>=r.y1&&y<=r.y2);

function openModal(content, closable=true){$('overlay').hidden=false;$('modal').innerHTML=content;if(closable)$('modal').querySelectorAll('[data-close]').forEach(close=>close.onclick=closeModal);}
function closeModal(){$('overlay').hidden=true;$('modal').innerHTML='';render();}
function resourceBar(){return `<div class="resource-bar" aria-label="Resources before this action"><span>Cash <b>${plainMoney(S.cash)}</b></span><span>AI credits <b>${Math.floor(S.credits)} ⚡</b></span><span>Focus <b>${S.focus}/5</b></span><span>Clock <b>${timeText()}</b></span></div>`;}

function loopPhase(){if(!S.morningDone)return'morning';if(!S.selectedTaskId)return'choose';if(!S.build)return'build';if(!allPassed())return'test';if(!S.shipped)return'ship';return'settle';}

function allPassed(){return !!task() && !!S.build && S.tested && S.testResults.length>0 && S.testResults.filter(r=>!r.skipped).every(r=>r.pass);}

function render(){
  const net = dailyProductResult(), t = task();
  $('hud-day').textContent = `${String(S.day).padStart(2,'0')} · ${timeText()}`;
  $('hud-cash').textContent = plainMoney(S.cash);
  $('hud-cash-note').textContent = `midnight costs ${plainMoney(FIXED_BURN)}`;
  $('hud-margin').textContent = fmtDay(net);
  $('hud-margin-note').textContent = `user revenue minus daily AI cost`;
  $('hud-compute').textContent = `${Math.floor(S.credits)} ⚡`;
  $('hud-energy').textContent = `${S.focus} / 5`;
  $('hud-runway').textContent = `${Math.max(0,runway()).toFixed(1)} days`;
  $('eco-net').textContent = fmtDay(net);
  $('eco-net').style.color = net>=0?'var(--green)':'var(--red)';
  $('eco-net-day').textContent = `daily user revenue minus daily AI cost`;
  $('eco-users-inline').textContent = String(S.users);
  $('eco-revenue').textContent = fmtDay(dailyRevenue());
  $('eco-ai').textContent = S.pendingLaunch&&!S.settled
    ? `${fmtDay(-S.aiDaily)} → ${fmtDay(-aiDailyAfter(S.pendingLaunch.aiDelta))} at midnight`
    : fmtDay(-S.aiDaily);
  $('eco-fixed').textContent = `−${plainMoney(FIXED_BURN)}`;
  const dayChange = projectedDayChange();
  $('eco-day').textContent = money(dayChange);
  $('eco-day').className = dayChange>=0?'good':'bad';
  $('impact').innerHTML = t
    ? `<b>${t.person} · ${t.title}</b>${t.problem}<div style="margin-top:6px"><strong>If skipped:</strong> ${t.ignoreLine}</div><div><strong>${eventName(t)} · ${clockText(eventDeadline(t))}:</strong> ${t.payoffLine}</div>`
    : `<b>Today’s stake</b>${S.morningDone?'Pick whose problem gets today at the product board (any station).':'Read the overnight message first.'}`;
  $('game-title').textContent = `Garage HQ · Day ${S.day}`;
  $('phase-pill').textContent = loopPhase().toUpperCase();
  $('end-day').disabled = !S.morningDone || S.gameOver;
  $('end-day').textContent = S.settled?'View day result':'End day';
  $('record').disabled = !S.morningDone;
  updateLoop(); updateStations(); updateNearest();
}

function updateLoop(){const order=['morning','choose','build','test','ship','settle'],idx=order.indexOf(loopPhase());document.querySelectorAll('[data-loop]').forEach(el=>{const i=order.indexOf(el.dataset.loop);el.classList.toggle('active',i===idx&&!S.settled);el.classList.toggle('done',S.settled||i<idx);});}

function updateStations(){
  const pass=allPassed();
  const oracle=document.querySelector('[data-station="oracle"]'),test=document.querySelector('[data-station="test"]'),outside=document.querySelector('[data-station="activity"]'),door=document.querySelector('[data-station="door"]');
  oracle.classList.toggle('done',!!S.build);
  oracle.querySelector('small').textContent = !S.selectedTaskId?'choose a task first':S.build?`build v${S.version} saved · revise here`:'choose product behavior';
  test.classList.toggle('done',pass);
  test.querySelector('small').textContent = !S.build?'needs a saved build':S.tested?(pass?'all checks passed':'failures explained inside'):'replay the incident';
  const activityCount=activities().length;
  outside.classList.toggle('done',activityCount>0);
  outside.querySelector('small').textContent = activityCount?`${activityCount} ${activityCount===1?'activity':'activities'} today · map still open`:'activities around the Valley';
  door.classList.toggle('locked',!S.build);
  door.classList.toggle('done',S.shipped);
  const deadline=eventDeadline(task());
  door.querySelector('small').textContent = !S.build?'build something first':S.shipped?'released today · end day to reconcile':S.demoAttended?'event done · release open':S.time+1>deadline?`${eventName(task())} closed · release open`:`${eventName(task())} closes ${clockText(deadline)}`;
}

function updateNearest(){S.nearest=null;}

function applyFacing(){const p=$('player');p.setAttribute('aria-label',`Founder facing ${S.facing==='back'?'up':S.facing}`);paintPlayerSprite();}
function collisionSafePosition(oldX,oldY,x,y){
  const targetX=Math.max(8,Math.min(92,x)),targetY=Math.max(16,Math.min(84,y));
  // Sweep the complete move in one-percent increments. This prevents a long
  // auto-walk tween from crossing furniture merely because its endpoint is clear.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(targetX-oldX),Math.abs(targetY-oldY))));
  let nextX=oldX,nextY=oldY;
  for(let i=1;i<=steps;i++){
    const desiredX=oldX+(targetX-oldX)*(i/steps);
    const desiredY=oldY+(targetY-oldY)*(i/steps);
    if(!collisionAt(desiredX,nextY))nextX=desiredX;
    if(!collisionAt(nextX,desiredY))nextY=desiredY;
  }
  return {x:nextX,y:nextY,targetX,targetY};
}
function movePlayer(x,y,then){
  const oldX=S.pos.x,oldY=S.pos.y;
  const safe=collisionSafePosition(oldX,oldY,x,y);
  const intendedDx=safe.targetX-oldX,intendedDy=safe.targetY-oldY;
  if(Math.abs(intendedDx)>=Math.abs(intendedDy)&&intendedDx!==0)S.facing=intendedDx<0?'left':'right';
  else if(intendedDy!==0)S.facing=intendedDy<0?'back':'front';
  const nextX=safe.x,nextY=safe.y;
  S.pos.x=nextX;S.pos.y=nextY;
  const dx=S.pos.x-oldX,dy=S.pos.y-oldY;
  if(dx===0&&dy===0){applyFacing();updateNearest();if(then)then();return;}
  const duration=Math.max(150,Math.min(620,Math.hypot(dx,dy)*13));
  const p=$('player');p.style.setProperty('--walk-time',`${duration}ms`);applyFacing();startPlayerAnimation('walk');p.style.left=`${S.pos.x}%`;p.style.top=`${S.pos.y}%`;updateNearest();
  clearTimeout(S._walkTimer);S._walkTimer=setTimeout(()=>{startPlayerAnimation('idle',true);applyFacing();updateNearest();if(then)then();},duration+30);
}

function stationAction(key){
  if(S.gameOver)return;
  if(!S.morningDone){startMorning();return;}
  if(!S.selectedTaskId && key!=='coffee'){showTaskBoard();return;}
  if(S.settled){toast('The day is settled.');return;}
  if(S.shipped&&['oracle','test'].includes(key)){
    toast('This launch is recorded. Settle the day; revisions belong to the next build.');
    return;
  }
  startPlayerAnimation('interact',true);clearTimeout(S._interactionTimer);S._interactionTimer=setTimeout(()=>startPlayerAnimation('idle',true),900);
  if(key==='oracle')showOracle();
  if(key==='test')showTest();
  if(key==='activity')showActivities();
  if(key==='coffee')useCoffee();
  if(key==='door')showDoor();
}
function walkRoute(points,done){
  const remaining=points.filter(p=>Math.hypot(S.pos.x-p.x,S.pos.y-p.y)>1);
  if(!remaining.length){done();return;}
  const [next,...rest]=remaining;
  // Animate routes as axis-aligned legs so their visible tween follows the
  // same collision-safe path used by the foot-point sweep.
  if(Math.abs(S.pos.x-next.x)>1){movePlayer(next.x,S.pos.y,()=>walkRoute([next,...rest],done));return;}
  movePlayer(next.x,next.y,()=>walkRoute(rest,done));
}
function autoWalk(key){
  stationAction(key);
}

/* ============================================================
   Day openings
   ============================================================ */
function startMorning(){ day7() ? showIncidentScene() : showDay8Morning(); }

function showIncidentScene(){
  showScene({
    cls:'night', art:ASSET.user47, artAlt:'USER_0047, a ClearRead user',
    pages:[
      {speaker:'23:58 · LAST NIGHT', title:'A message arrives', html:`
        <div class="phone-msg"><span class="from">USER_0047</span><span class="when">23:58</span>
        <p>hey. my grandma started her new blood-pressure pills tonight. the label is glossy and ClearRead read the <b>wrong dose</b> out loud. confidently.</p></div>
        <div class="phone-msg"><span class="from">USER_0047</span><span class="when">23:59</span>
        <p>she almost took two. the box says half.</p></div>`},
      {speaker:'USER_0047', html:`
        <p>“She’s okay — she double-checked the leaflet. But she trusted the app because <b>I</b> told her to.”</p>
        <p>“Why didn’t it just say it couldn’t read the label?”</p>`,
        aside:'It didn’t say so because nobody ever told it to. ORACLE builds exactly what it is asked — nothing more.'},
      {speaker:'FOUNDER · 09:00, DAY 7', title:'Morning', html:`
        <p>84 people use ClearRead every day. Last night it failed the one person it was built for.</p>
        <p>One day. One product focus. Build, test, revise, and release while the clock and resources last.</p>`,
        aside:'The money, briefly: 84 users generate $7.56/day. ClearRead costs $2.25/day in AI to run, leaving $5.31 before $105 in rent and tools. Cash lasts about 5.6 days if nothing changes.'}
    ],
    doneLabel:'Open the product board',
    onDone:()=>{S.morningDone=true;showTaskBoard();}
  });
}

/* ============================================================
   Task board (both days) — story first, receipts before selection
   ============================================================ */
function ignoreReceipt(t){
  if(t.id==='bill')return `<div class="receipt bill"><b>If you skip it today</b>
    <div class="r-row"><span>Daily AI cost stays</span><strong>${plainMoney(S.aiDaily)}/day</strong></div>
    <div class="r-row"><span>${t.ignoreLine}</span></div></div>`;
  if(!t.ignoreUsers) return `<div class="receipt"><b>If you skip it today</b><div class="r-row"><span>${t.ignoreLine}</span></div></div>`;
  const after = S.users - t.ignoreUsers;
  const now = dailyProductResult(), then = after*REV_PER_USER_DAY - S.aiDaily;
  return `<div class="receipt bill"><b>If you skip it today</b>
    <div class="r-row"><span>Users</span><strong>${S.users} <span class="arrow">→</span> ${after}</strong></div>
    <div class="r-row"><span>Income</span><strong>${fmtDay(now)} <span class="arrow">→</span> ${fmtDay(then)}</strong></div>
    <div class="r-row"><span>${t.ignoreLine}</span></div></div>`;
}

function taskEconomyPreview(t){
  if(t.id!=='bill')return'';
  const evidence=aiDailyAfter(t.honest.ai),wide=aiDailyAfter(t.hype.ai);
  return `<div class="receipt gain"><b>If the tested optimization ships</b>
    <div class="r-row"><span>Evidence-matched daily AI cost</span><strong>${plainMoney(S.aiDaily)} → ${plainMoney(evidence)}</strong></div>
    <div class="r-row"><span>Next full day</span><strong>${money(evidence-S.aiDaily)}</strong></div>
    <div class="r-row"><span>Wider-launch daily AI cost</span><strong>${plainMoney(S.aiDaily)} → ${plainMoney(wide)}</strong></div>
  </div>`;
}

function showTaskBoard(){
  const set = taskSet(), ids = Object.keys(set);
  openModal(`<div class="modal-head"><div><div class="micro">Product board · day ${S.day}</div><h2 id="modal-title">Which problem gets today?</h2><p>Choose one product focus. Some cards improve an existing product; a card marked “New product” starts a separate app. You may revise, rebuild, and retest while time and resources remain.</p></div></div>
  <div class="modal-body"><div class="task-grid">${ids.map((id,i)=>{const t=set[id];return `
    <article class="task-card ${i===0?'featured':''}">
      <div class="task-art" style="background-position:${(t.art%3)*50}% ${t.art>2?100:0}%;background-image:url('${ASSET.taskArt}')"></div>
      <div class="inner">
        <div class="app-type">${productScope(t)}</div>
        <h3>${t.title}</h3>
        <p><b>${t.person}.</b> ${t.problem}</p>
        <p style="color:var(--ink)">${t.takes}</p>
        ${ignoreReceipt(t)}
        ${taskEconomyPreview(t)}
        <div class="receipt gain"><b>${eventName(t)} · closes ${clockText(eventDeadline(t))}</b><div class="r-row"><span>${t.payoffLine}</span></div></div>
        <button class="btn ${i===0?'primary':'cyan'}" data-task="${id}">${taskButtonLabel(t)}</button>
      </div>
    </article>`;}).join('')}</div>
  </div>`, false);
  $('modal').querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>chooseTask(b.dataset.task));
}

function chooseTask(id){
  S.selectedTaskId=id;S.answers={};S.qIndex=0;S.selected=[];S.reviewedSlots=[];
  S.build=null;S.tested=false;S.testResults=[];S.shipped=false;S.issueResolved=false;S.pendingLaunch=null;S.launchSettlement=null;S.demoAttended=false;S.demoResult='';S.version=0;
  closeModal();
  const t=task();
  toast(`${productScope(t)}: ${t.title}`);
  if(!S.inviteShown){S.inviteShown=true;showInviteScene();}
  else $('world-message').textContent=`${productScope(t)}. Today’s goal: ${t.title}. Next: go to ORACLE Studio and answer four product questions.`;
  render();
}

function showInviteScene(){
  const t=task(),deadline=clockText(eventDeadline(t));
  showScene({
    pages:[{speaker:'10:02 · TODAY’S OPPORTUNITY', title:eventName(t), html:`
      <div class="phone-msg"><span class="from">${eventName(t).toUpperCase()}</span><span class="when">${deadline}</span>
      <p>${t.payoffLine}</p></div>
      <div class="phone-msg"><span class="from">GARAGE HQ</span><span class="when">MIDNIGHT</span>
      <p>The event closes at <b>${deadline}</b>. Releasing from the garage stays available until midnight.</p></div>`,
      aside:`The deadline is tied to this customer’s schedule and the task’s value. Missing it loses the ${plainMoney(t.sponsor)} payment opportunity; it does not end the day.`}],
    doneLabel:'Got it',
      onDone:()=>{const t=task();$('world-message').textContent=`${productScope(t)}. Today’s goal: ${t.title}. Next: go to ORACLE Studio and answer four product questions.`;}
  });
}

/* ============================================================
   ORACLE — Day 7 staged Q&A
   ============================================================ */
function showOracle(){ day7() ? showOracleDay7() : showOracleDay8(); }

function instructionSoFar(){
  const t=task();
  const parts = QUESTIONS.map(q=>{
    const a = S.answers[q.slot];
    if(!a) return `<span class="pending">· (${questionFor(t,q.slot).toLowerCase()} — not answered yet)</span>`;
    const opt = t.answers[q.slot].find(o=>o.id===a);
    return `· ${displayFeature(opt.text)}`;
  });
  return parts.join('<br>');
}

function showOracleDay7(){
  const t=task();
  if(!S.oracleIntroDone){
    showScene({
      art:ASSET.oracleIntro, artAlt:'ORACLE, the build assistant',
      pages:[{speaker:'ORACLE', title:'“Tell me what to build.”', html:`
        <p>“I’ll run a four-question product interview. Each answer chooses a behavior, a user situation, a proof, or a boundary.”</p>
        <p>“I’ll turn those decisions into an implementation brief. There is no magic phrase and no hidden answer — the tradeoffs are visible before you buy.”</p>`,
        aside:`Working on: ${t.app} — ${t.title}.`}],
      doneLabel:'Start the questions',
      onDone:()=>{S.oracleIntroDone=true;showQuestion();}
    });
    return;
  }
  if(S.qIndex>=QUESTIONS.length || S.build) showBuildChoice();
  else showQuestion();
}

function showQuestion(){
  const t=task();
  // find first unanswered question
  let idx = QUESTIONS.findIndex(q=>!S.answers[q.slot]);
  if(idx===-1){showBuildChoice();return;}
  const q = QUESTIONS[idx],question=questionFor(t,q.slot);
  const opts = t.answers[q.slot];
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE · ${t.app} · ${t.title}</div><h2 id="modal-title">Question ${idx+1} of 4</h2><p>${t.person}: ${t.problem}</p>${resourceBar()}</div></div>
  <div class="modal-body">
    <div class="plain-rule"><b>No hidden correct answer.</b> Pick the behavior you want to build. The incident replay will show exactly what it handles and what remains outside the build.</div>
    <div class="qa-step"><div class="qnum">ORACLE ASKS</div><h3>${question}</h3>
      <div class="qa-options">${opts.map(o=>`<button class="qa-option" data-answer="${o.id}"><b>${displayFeature(o.text)}</b></button>`).join('')}</div>
    </div>
    <div class="instruction-panel"><span class="slot-label">YOUR INSTRUCTION SO FAR</span>${instructionSoFar()}</div>
  </div>`, false);
  $('modal').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{S.answers[q.slot]=b.dataset.answer;showQuestion();});
}

function showBuildChoice(){
  const t=task();
  const answered = QUESTIONS.every(q=>S.answers[q.slot]);
  if(!answered){showQuestion();return;}
  const quick = {credits:90, hours:1, focus:1};
  const careful = {credits:180, hours:1.5, focus:1};
  const quickRepeat=repeatBuildBlocked('quick'),carefulRepeat=repeatBuildBlocked('careful');
  const revision = S.build ? `This replaces build v${S.version} — a fresh build, paid again.` : '';
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE · ${t.app} · ${t.title}</div><h2 id="modal-title">Your instruction is ready</h2><p>Change any answer, then choose how the build is made. ${revision}</p>${resourceBar()}</div></div>
  <div class="modal-body">
    <div class="instruction-panel"><span class="slot-label">IMPLEMENTATION BRIEF</span>${instructionSoFar()}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${QUESTIONS.map((q,i)=>`<button class="btn ghost" data-redo="${q.slot}" style="font-size:11px">Change answer ${i+1}</button>`).join('')}</div>
    <div class="build-choice">
      <div class="build-card">
        <h3>Quick build</h3>
        <div class="price">${quick.credits} prepaid ⚡ · ${quick.hours}h · ${quick.focus} Focus · operating cash ${money(operatingCashFor(quick.hours))}</div>
        <p>“The cheap way. Plainly: a quick build is <b>more likely to leave a coding bug</b> — even in behaviors you chose correctly. We’ll only know when we test.”</p>
        <p style="font-size:12px;color:var(--muted)">If a bug slips through: finding it costs a test run (30 ⚡ · 1h · 1 Focus), and fixing it costs another generated build. A late bug can cost you the ${clockText(eventDeadline(t))} customer event.</p>
        <button class="btn cyan" id="build-quick" ${quickRepeat||S.credits<quick.credits||S.focus<quick.focus||S.time+quick.hours>24?'disabled':''}>${quickRepeat?'Already saved — test this build':'Buy the quick build'}</button>
      </div>
      <div class="build-card careful">
        <h3>Careful build</h3>
        <div class="price">${careful.credits} prepaid ⚡ · ${careful.hours}h · ${careful.focus} Focus · operating cash ${money(operatingCashFor(careful.hours))}</div>
        <p>“Twice the price. I take my time and check my own work — a coding bug is very unlikely.”</p>
        <p style="font-size:12px;color:var(--muted)">Buys code quality only. It cannot add a behavior that the brief never requested.</p>
        <button class="btn primary" id="build-careful" ${carefulRepeat||S.credits<careful.credits||S.focus<careful.focus||S.time+careful.hours>24?'disabled':''}>${carefulRepeat?'Already saved — test this build':'Buy the careful build'}</button>
      </div>
    </div>
    <div class="plain-rule">The brief is the product strategy. Tests check whether the build performs each chosen behavior; the incident replay separately shows whether this strategy solves today’s case.</div>
    ${S.focus<1?'<div class="plain-rule" style="border-left-color:var(--yellow)">Not enough Focus to build — coffee at the bar restores 2 for $18.</div>':''}
    <div class="modal-actions"><button class="btn" data-close>Back to the garage</button></div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-redo]').forEach(b=>b.onclick=()=>{delete S.answers[b.dataset.redo];showQuestion();});
  const q=$('build-quick'), c=$('build-careful');
  if(q&&!q.disabled)q.onclick=()=>generateDay7('quick',quick);
  if(c&&!c.disabled)c.onclick=()=>generateDay7('careful',careful);
}

function chosenOptions(a){const t=task();const ans=a||S.answers;return QUESTIONS.map(q=>({slot:q.slot,opt:t.answers[q.slot].find(o=>o.id===ans[q.slot])})).filter(x=>x.opt);}
function fitScore(a){return chosenOptions(a).reduce((n,x)=>n+x.opt.fit,0);}
function fitLevel(a){const ctx=chosenOptions(a).find(x=>x.slot==='context');const s=fitScore(a);if(s>=6&&ctx&&ctx.opt.fit===2)return'closed';if(s>=3)return'partial';return'open';}
function provenSegmentUsers(a){const t=task();if(!day7())return t.honest.users;const lvl=fitLevel(a);return Math.max(2,t.honest.users-(lvl==='partial'?3:lvl==='open'?6:0));}
function fitReadout(a){const t=task();const lvl=fitLevel(a);const hits=chosenOptions(a).filter(x=>x.opt.fit===2).map(x=>`“${displayFeature(x.opt.text)}”`);const misses=chosenOptions(a).filter(x=>x.opt.fit===0).map(x=>`“${displayFeature(x.opt.text)}”`);
  const verdict=lvl==='closed'?`As specced, ${t.caseName} cannot happen again.`:lvl==='partial'?`This spec narrows ${t.caseName}, but it can still occur.`:`Nothing in this spec prevents ${t.caseName} from repeating.`;
  return {lvl,verdict,hits,misses};}
function honestClaim(){const t=task();if(!day7()||!S.build)return t.honestCopy;const o=Object.fromEntries(chosenOptions(S.build.answers).map(x=>[x.slot,x.opt]));return `New in ${t.app}: it will ${o.goal.text}, ${o.context.text}. ${o.guardrail.fit>0?`Rule: ${o.guardrail.text}.`:''}`.trim();}
function oddsWords(p){return p>=0.7?'more likely than not':p>=0.45?'about a coin flip':p>=0.3?'about 1 in 3':'unlikely, not impossible';}
function sameDay7Build(kind){return day7()&&S.build?.kind===kind&&JSON.stringify(S.build.answers||{})===JSON.stringify(S.answers||{});}
function repeatBuildBlocked(kind){return sameDay7Build(kind)&&(!S.tested||!S.build.defect);}

function generateDay7(kind,cost){
  if(repeatBuildBlocked(kind)||S.credits<cost.credits||S.focus<cost.focus||S.time+cost.hours>24)return;
  const before={credits:S.credits,focus:S.focus,cash:S.cash,time:timeText()};
  S.credits-=cost.credits;S.focus-=cost.focus;advanceTime(cost.hours);
  S.version+=1;
  const seed=(Date.now()^(S.version*7919))>>>0;
  const rng=mulberry32(seed);
  // Code quality comes from the implementation pass, not from product scope.
  // Day 7 keeps the exact probability hidden, as required by the validated slice.
  let defect=false;
  const classHelp=didActivity('class');
  if(kind==='quick') defect = S.version===1&&!classHelp ? true : rng()<(classHelp?0.25:0.35);
  else defect = rng()<(classHelp?0.02:0.05);
  const testable=chosenOptions().filter(x=>x.opt.test);
  const hitPool=testable;
  const defectSlot=defect&&hitPool.length?hitPool[Math.floor(rng()*hitPool.length)].slot:'';
  S.build={kind,answers:{...S.answers},fit:fitLevel(),defect,defectSlot,seed,cost:cost.credits,instruction:instructionSoFar().replace(/<[^>]+>/g,'')};
  S.tested=false;S.testResults=[];
  closeModal();
  $('world-message').textContent=`Build v${S.version} saved (${kind}). Take it to the Test Bench — the tests replay ${task().person}’s incident.`;
  toast(`Build v${S.version}: ${before.credits}→${S.credits} ⚡ · Focus ${before.focus}→${S.focus} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);
  render();
}

/* ============================================================
   ORACLE — Day 8 uses the same understandable build contract
   ============================================================ */
function availableChips(){const t=task();return t?t.chips:[];}
function requiredChips(){return availableChips().filter(c=>c.required);}
function coverageCount(){return requiredChips().filter(c=>S.selected.includes(c.id)).length;}

function promptSentence(){
  const t=task();if(!t)return'';
  const chosen=t.chips.filter(c=>S.selected.includes(c.id));
  if(!chosen.length)return'Pick clauses to form the instruction ORACLE receives.';
  const by=Object.fromEntries(chosen.filter(c=>c.required).map(c=>[c.slot,c.text]));
  const s=[];
  if(by.goal)s.push(`Build ${t.app} to ${by.goal}.`);
  if(by.context)s.push(`It matters most ${by.context.startsWith('keep')||by.context.startsWith('cope')?'that it can ':'when it must '}${by.context}.`);
  if(by.success)s.push(`It works if it can ${by.success}.`);
  if(by.guardrail)s.push(`It must always ${by.guardrail}.`);
  return s.join(' ');
}

function showOracleDay8(){
  const next=SLOT_ORDER.find(slot=>!S.reviewedSlots.includes(slot));
  if(next){showDay8Question(next);return;}
  showDay8BuildChoice();
}

const SLOT_ORDER=['goal','context','success','guardrail'];
function showDay8Question(slot){
  const t=task(),index=SLOT_ORDER.indexOf(slot),chip=requiredChips().find(c=>c.slot===slot);
  const included=S.selected.includes(chip.id);
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE · ${t.app}</div><h2 id="modal-title">Question ${index+1} of 4</h2><p>${t.person}: ${t.problem}</p>${resourceBar()}</div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    <div class="qa-step"><div class="qnum">ORACLE ASKS</div><h3>${questionFor(t,slot)}</h3>
      <div class="qa-options">
        <button class="qa-option ${included?'selected':''}" id="day8-include"><b>${displayFeature(chip.text)}</b></button>
        <button class="qa-option" id="day8-omit"><b>Leave this requirement out of the build</b></button>
      </div>
    </div>
    <div class="instruction-panel"><span class="slot-label">YOUR INSTRUCTION SO FAR</span>${promptSentence()}</div>
  </div>`);
  const finish=include=>{S.selected=S.selected.filter(id=>id!==chip.id);if(include)S.selected.push(chip.id);if(!S.reviewedSlots.includes(slot))S.reviewedSlots.push(slot);showOracleDay8();};
  $('day8-include').onclick=()=>finish(true);
  $('day8-omit').onclick=()=>finish(false);
}

function showDay8BuildChoice(){
  const t=task();
  const standard={credits:120,hours:1,focus:1},reviewed={credits:240,hours:1.5,focus:1};
  const same=(kind)=>S.build?.kind===kind&&JSON.stringify(S.build.chips||[])===JSON.stringify(S.selected||[])&&(!S.tested||!S.build.defect);
  const standardRepeat=same('standard'),reviewedRepeat=same('reviewed');
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE STUDIO · ${t.app} · ${t.title}</div><h2 id="modal-title">Choose how ORACLE implements the brief</h2><p>The same four product questions lead to the same two build choices. A reviewed build costs more because ORACLE checks the generated code before handing it back.</p>${resourceBar()}</div><button class="close" data-close aria-label="Close">×</button></div>
  <div class="modal-body">
    <div class="task-reminder"><div><b>${t.person}</b><span>${t.problem}</span></div><strong>${eventName(t)} · ${clockText(eventDeadline(t))}</strong></div>
    <div class="coverage">${requiredChips().map(c=>`<button class="${S.selected.includes(c.id)?'covered':''}" data-review="${c.slot}"><b>${questionFor(t,c.slot)}</b><span>${S.selected.includes(c.id)?displayFeature(c.text):'Left unanswered'} · change</span></button>`).join('')}</div>
    <div class="prompt-readback"><span class="slot-label">GENERATED BUILD BRIEF</span>${promptSentence()}</div>
    <div class="build-choice">
      <div class="build-card"><h3>Standard build</h3>
        <div class="price">${standard.credits} prepaid ⚡ · ${standard.hours}h · ${standard.focus} Focus · operating cash ${money(operatingCashFor(standard.hours))}</div>
        <p>ORACLE generates the code once. Your four requirements remain exactly as written; the Test Bench reveals whether the implementation needs another pass.</p>
        <button class="btn cyan" id="build-standard" ${standardRepeat||coverageCount()<1||S.credits<standard.credits||S.focus<standard.focus||S.time+standard.hours>24?'disabled':''}>${standardRepeat?'Already saved — test this build':'Buy the Standard build'}</button>
      </div>
      <div class="build-card careful"><h3>Reviewed build</h3>
        <div class="price">${reviewed.credits} prepaid ⚡ · ${reviewed.hours}h · ${reviewed.focus} Focus · operating cash ${money(operatingCashFor(reviewed.hours))}</div>
        <p>ORACLE generates the same brief, then checks the implementation before returning it. This buys code review; it cannot invent a requirement you left out.</p>
        <button class="btn primary" id="build-reviewed" ${reviewedRepeat||coverageCount()<1||S.credits<reviewed.credits||S.focus<reviewed.focus||S.time+reviewed.hours>24?'disabled':''}>${reviewedRepeat?'Already saved — test this build':'Buy the Reviewed build'}</button>
      </div>
    </div>
    <div class="plain-rule">Omitted requirements fail because they were never requested. An implementation defect is different: you requested the behavior, but the generated code needs another pass. The Test Bench names which one happened.</div>
    <div class="modal-actions">
      ${S.credits<standard.credits?`<button class="btn" id="buy-credits" ${S.cash<125?'disabled':''}>Buy 500 ⚡ · cash ${plainMoney(S.cash)} → ${plainMoney(S.cash-125)}</button>`:''}
      <button class="btn" data-close>Back</button>
    </div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{S.reviewedSlots=S.reviewedSlots.filter(x=>x!==b.dataset.review);showOracleDay8();});
  const buy=$('buy-credits');if(buy&&!buy.disabled)buy.onclick=confirmCreditPurchase;
  const standardButton=$('build-standard'),reviewedButton=$('build-reviewed');
  if(standardButton&&!standardButton.disabled)standardButton.onclick=()=>generateDay8('standard',standard);
  if(reviewedButton&&!reviewedButton.disabled)reviewedButton.onclick=()=>generateDay8('reviewed',reviewed);
}

function confirmCreditPurchase(){
  const beforeCash=S.cash,beforeCredits=S.credits;
  openModal(`<div class="modal-head"><div><div class="micro">AI credit purchase</div><h2 id="modal-title">Move $125 from cash into prepaid credits?</h2><p>This is an immediate purchase, not a midnight estimate.</p></div></div>
    <div class="modal-body"><table class="settle-table"><tr><td>Cash</td><td>${plainMoney(beforeCash)} → ${plainMoney(beforeCash-125)}</td></tr><tr><td>AI credits</td><td>${Math.floor(beforeCredits)} ⚡ → ${Math.floor(beforeCredits+500)} ⚡</td></tr></table>
    <div class="modal-actions"><button class="btn" id="credit-cancel">Cancel</button><button class="btn primary" id="credit-confirm">Buy 500 ⚡</button></div></div>`,false);
  $('credit-cancel').onclick=showDay8BuildChoice;
  $('credit-confirm').onclick=()=>{if(S.cash<125)return;S.cash-=125;S.credits+=500;S.purchaseSpend+=125;toast(`AI credits purchased · cash ${plainMoney(beforeCash)} → ${plainMoney(S.cash)}`);showDay8BuildChoice();render();};
}

function generateDay8(kind,cost){
  if(cost.credits>S.credits||S.focus<cost.focus||S.time+cost.hours>24)return;
  const before={credits:S.credits,focus:S.focus,cash:S.cash};
  S.credits-=cost.credits;S.focus-=cost.focus;advanceTime(cost.hours);
  S.version+=1;
  const seed=(Date.now()^(S.version*104729))>>>0;
  const req=requiredChips().map(c=>c.id).filter(id=>S.selected.includes(id));
  const defect=kind==='standard'&&!didActivity('class');
  const coveredReq=task().chips.filter(c=>c.required&&req.includes(c.id));
  const defectSlot=defect&&coveredReq.length?coveredReq[0].slot:'';
  S.build={kind,chips:[...S.selected],covered:req,seed,defect,defectSlot,cost:cost.credits,instruction:promptSentence()};
  S.tested=false;S.testResults=[];
  closeModal();
  $('world-message').textContent=task().id==='bill'
    ? `Build v${S.version} saved — the optimization is not live yet. Test it, then record a launch; the daily AI cost changes only at midnight.`
    : `Build v${S.version} saved — ${coverageCount()}/4 requirements included. The Test Bench checks the brief and the code.`;
  toast(`Build v${S.version}: ${before.credits}→${S.credits} ⚡ · Focus ${before.focus}→${S.focus} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);
  render();
}

/* ============================================================
   Test bench — failures name their cause
   ============================================================ */
function runTestRows(){
  const t=task(),b=S.build;
  let rows;
  if(day7()){
    rows=chosenOptions(b.answers).map(x=>{
      if(!x.opt.test)return {name:`No check possible: “${x.opt.text}”`,detail:'This clause is a wish, not a behavior — there is nothing a test can run tonight. It ships unverified.',slot:x.slot,pass:true,skipped:true,why:'',fix:''};
      const hit=b.defect&&b.defectSlot===x.slot;
      return {name:x.opt.test.name,detail:x.opt.test.detail,slot:x.slot,pass:!hit,
        why:hit?`You specced this and ORACLE built it — but the ${b.kind} build left a coding bug in it. Revise or regenerate it at ORACLE.`:'',fix:hit?'oracle':''};
    });
  }else{
    rows=t.tests.map(x=>{
      const chip=t.chips.find(c=>c.slot===x.slot&&c.required);
      const pass=b.chips.includes(chip.id);
      return {name:x.name,detail:x.detail,slot:x.slot,pass,
        why:pass?'':`The instruction never included “${chip.text}”. ORACLE built exactly what you asked.`,fix:pass?'':'oracle'};
    });
  }
  if(didActivity('photo')){
    const pass=day7()&&(b.answers.context==='glare'||b.answers.goal==='enhance');
    rows.push({name:'Changing-light photo',detail:'The photography walk supplied the same label moving from shade into glare.',slot:'activity',pass,
      why:pass?'':'The build brief never targeted glare or photo cleanup. Revise that product decision at ORACLE.',fix:pass?'':'oracle'});
  }
  // the code check: separate failure category
  let codePass=!b.defect,codeWhy='',codeFix='';
  const slotName=(sl)=>{if(day7()){const x=chosenOptions(b.answers).find(v=>v.slot===sl);return x&&x.opt.test?x.opt.test.name.toLowerCase():'a specified behavior';}const x=task().tests.find(v=>v.slot===sl);return x?x.name.toLowerCase():'a specified behavior';};
  if(!codePass){
    codeWhy=day7()
      ? `You asked for this correctly — but the ${b.kind} build left a coding bug in the ${slotName(b.defectSlot)} behavior. Regenerate it at ORACLE.`
      : `Everything was specified — the Standard build still carries a coding defect in the ${slotName(b.defectSlot)} behavior. Regenerate it at ORACLE or buy the Reviewed build.`;
    codeFix='oracle';
  }
  rows.push({name:'Code check',detail:day7()
    ? (S.tested?(codePass?'No coding defects in this build.':'A defect was found.') : 'Did the build come out of ORACLE without a coding bug? Unknown until you run the tests.')
    : (S.tested?(codePass?'No coding defects in this build.':'A coding defect was found.'):'The implementation has not been checked yet.'),
    slot:'code',pass:codePass,why:codeWhy,fix:codeFix});
  if(!codePass){const hit=rows.find(r=>r.slot===b.defectSlot);if(hit&&hit.pass)hit.note='You asked for this correctly — the code check below found the bug in how it was built.';}
  return rows;
}

function showTest(){
  if(!S.build){openModal(`<div class="modal-head"><div><div class="micro">Test bench</div><h2 id="modal-title">Nothing to test yet</h2><p>Describe the build at ORACLE first — the tests replay the incident against whatever you actually asked for.</p></div><button class="close" data-close>×</button></div><div class="modal-body"><div class="modal-actions"><button class="btn primary" id="go-oracle">Walk to ORACLE</button></div></div>`);$('modal').querySelector('[data-close]').onclick=closeModal;$('go-oracle').onclick=()=>{closeModal();autoWalk('oracle');};return;}
  if(!S.tested){
    const rows=runTestRows(),cost=30;
    openModal(`<div class="modal-head"><div><div class="micro">Test bench · ${task().app} · build v${S.version}</div><h2 id="modal-title">Replay the incident</h2><p>${task().person}’s case, re-run against the saved build · ${cost} prepaid ⚡ · 1 Focus · 1 hour · operating cash ${money(operatingCashFor(1))}.</p>${resourceBar()}</div><button class="close" data-close>×</button></div>
    <div class="modal-body">
      <div class="test-list">${rows.map(x=>`<div class="test-row"><span class="icon">○</span><div><b>${x.name}</b><small>${x.detail}</small></div><strong>NOT RUN</strong></div>`).join('')}</div>
      <div class="plain-rule">Two different ways to miss here: a product behavior absent from the build brief, or an implementation defect in a behavior you selected. The results identify which one happened and route you to the right fix.</div>
      ${S.focus<1?'<div class="plain-rule" style="border-left-color:var(--yellow)">Not enough Focus to test — coffee at the bar restores 2 for $18.</div>':''}
      <div class="modal-actions"><button class="btn" data-close>Back</button><button class="btn primary" id="run-tests" ${S.credits<cost||S.focus<1||S.time+1>24?'disabled':''}>Run the tests · ${cost} ⚡ · 1 Focus · 1h</button></div>
    </div>`);
    $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
    const run=$('run-tests');if(run&&!run.disabled)run.onclick=()=>{const before={credits:S.credits,focus:S.focus,cash:S.cash};S.credits-=30;S.focus-=1;advanceTime(1);S.tested=true;S.testResults=runTestRows();toast(`Test run: ${before.credits}→${S.credits} ⚡ · Focus ${before.focus}→${S.focus} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);showTestResults();render();};
    return;
  }
  showTestResults();
}

function showTestResults(){
  const rows=S.testResults,real=rows.filter(r=>!r.skipped),passed=real.filter(r=>r.pass).length,skipped=rows.length-real.length,all=passed===real.length;
  openModal(`<div class="modal-head"><div><div class="micro">Test results · build v${S.version}</div><h2 id="modal-title">${passed}/${real.length} checks passed${skipped?` · ${skipped} unverifiable`:''}</h2><p>${all?`${task().person}’s case now works in this build. It’s ready to demo and, if you choose, to release.`:'Failures below say exactly why and where to fix them. Nothing here ends the day — or the company.'}</p></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    ${day7()&&S.build?(()=>{const r=fitReadout(S.build.answers);return `<div class="plain-rule" style="border-left-color:${r.lvl==='closed'?'var(--green)':r.lvl==='partial'?'var(--yellow)':'var(--red)'}"><b>Does this spec close ${task().caseName}?</b> ${r.verdict}${r.misses.length?` Not aimed at it: ${r.misses.join(', ')}.`:''}</div>`;})():''}
    <div class="test-list">${rows.map(x=>`<div class="test-row"><span class="icon">${x.skipped?'—':x.pass?'✓':'×'}</span><div><b>${x.name}</b><small>${x.detail}</small></div><strong class="${x.skipped?'':x.pass?'pass':'fail'}" style="${x.skipped?'color:var(--yellow)':''}">${x.skipped?'SKIPPED':x.pass?'PASS':'FAIL'}</strong>
      ${x.note?`<div class="fail-why"><b style="color:var(--yellow)">Note:</b> ${x.note}</div>`:''}
      ${!x.pass?`<div class="fail-why"><b>Why:</b> ${x.why}<button class="fix" data-fix="oracle">${x.slot==='code'?'Regenerate at ORACLE ▸':'Revise at ORACLE ▸'}</button></div>`:''}</div>`).join('')}</div>
    <div class="modal-actions"><button class="btn" data-close>Back to the garage</button>${all?'<button class="btn primary" id="go-door">To customer event / release</button>':''}</div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{closeModal();autoWalk('oracle');});
  const door=$('go-door');if(door)door.onclick=()=>{closeModal();autoWalk('door');};
}

/* ============================================================
   Outside map — several distinct activities, bounded by time and cash
   ============================================================ */
function activityAvailable(a,t){
  if(a.id==='photo')return t?.id==='glare';
  if(a.id==='grandma')return t?.app==='ClearRead';
  if(a.id==='meetup'&&S.demoAttended)return false;
  return true;
}

function showActivities(){
  const t=task(),done=activities();
  openModal(`<div class="modal-head"><div><div class="micro">Garage exit · outside map</div><h2 id="modal-title">Where do you go next?</h2><p>Take as many different activities as the day, your cash, and the schedule allow. Each location is available once per day.</p></div><button class="close" data-close>×</button></div>
    <div class="modal-body"><div class="task-grid">${Object.values(ACTIVITIES).map(a=>{
      const used=didActivity(a.id),allowed=activityAvailable(a,t),operations=operatingCashFor(a.hours),total=operations-a.cash;
      return `<article class="task-card"><div class="inner"><div class="app-type">${a.place} · ${a.hours}h</div><h3>${a.name}</h3><p>${a.effect}</p>
        <div class="receipt"><b>${used?'Completed today':'Time and cash'}</b><div class="r-row"><span>Direct cost</span><strong>−${plainMoney(a.cash)}</strong></div><div class="r-row"><span>Company operations while away</span><strong>${money(operations)}</strong></div><div class="r-row"><span>Net cash change</span><strong>${money(total)}</strong></div></div>
        ${allowed?'':`<p>This effect does not connect to today’s selected product state.</p>`}
        <button class="btn cyan" data-activity="${a.id}" ${used||!allowed||S.cash<a.cash||S.time+a.hours>24?'disabled':''}>${used?'Done today':`Go · cash ${plainMoney(S.cash)} → ${plainMoney(S.cash+total)}`}</button></div></article>`;
    }).join('')}</div>${done.length?`<div class="plain-rule"><b>Today so far:</b> ${done.map(a=>a.name).join(' · ')}. You can choose another distinct activity or return to the garage.</div>`:''}</div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-activity]').forEach(b=>b.onclick=()=>chooseActivity(b.dataset.activity));
}

function chooseActivity(id){
  const a=ACTIVITIES[id],t=task();
  if(!a||didActivity(id)||!activityAvailable(a,t)||S.cash<a.cash||S.time+a.hours>24)return;
  const before=S.cash;
  S.cash-=a.cash;S.activitySpend+=a.cash;advanceTime(a.hours);S.activityIds.push(id);
  if(a.focus)S.focus=Math.min(5,S.focus+a.focus);
  closeModal();
  $('world-message').textContent=`Outside block complete: ${a.name}. ${a.effect}`;
  toast(`${a.name} · cash ${plainMoney(before)} → ${plainMoney(S.cash)} · clock ${timeText()}`);
  render();
}

/* ============================================================
   Coffee
   ============================================================ */
function useCoffee(){
  if(S.focus>=5){toast('Focus is already full.');return;}
  if(S.cash<18){toast('Not enough cash for the $18 coffee.');return;}
  if(S.time+0.5>24){toast('Too late for coffee.');return;}
  const operations=operatingCashFor(0.5),total=operations-18;
  openModal(`<div class="modal-head"><div><div class="micro">Coffee bar · 30 minutes</div><h2 id="modal-title">Restore 2 Focus?</h2><p>Thirty minutes passes, just like any other timed action.</p></div><button class="close" data-close>×</button></div><div class="modal-body"><table class="settle-table"><tr><td>Coffee</td><td>−${plainMoney(18)}</td></tr><tr><td>Company operations while away</td><td>${money(operations)}</td></tr><tr class="total"><td>Cash change</td><td>${money(total)}</td></tr></table><div class="plain-rule">Users keep paying for ClearRead while it serves them, and those same scans keep using AI. This is the same operating calculation used for builds, tests, events, and outside activities.</div><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn primary" id="buy-coffee">Buy coffee · cash ${plainMoney(S.cash)} → ${plainMoney(S.cash+total)}</button></div></div>`);
  $('buy-coffee').onclick=()=>{const before=S.cash;S.cash-=18;S.coffeeSpend+=18;S.focus=Math.min(5,S.focus+2);advanceTime(0.5);closeModal();toast(`Coffee: cash ${plainMoney(before)}→${plainMoney(S.cash)} · +2 Focus · clock ${timeText()}`);render();};
}

/* ============================================================
   Timed customer event → release
   ============================================================ */
function showDoor(){
  if(S.shipped){showAlreadyReleased();return;}
  if(!S.build){toast('Build something first.');return;}
  const t=task(),deadline=eventDeadline(t),open=eventOpen(t),name=eventName(t);
  const pass=allPassed();
  if(!pass){
    const failCount=S.tested?S.testResults.filter(r=>!r.pass).length:null;
    openModal(`<div class="modal-head"><div><div class="micro">${name} · ${open?`open until ${clockText(deadline)}`:'closed'}</div><h2 id="modal-title">${S.tested?'This build has known failures':'This build is untested'}</h2><p>${open?'You can still show unfinished work for feedback, but the customer only pays for a working result.':'This customer opportunity has closed. Release remains available until midnight, but only a fully passing build can ship.'}</p></div><button class="close" data-close>×</button></div>
    <div class="modal-body">
      ${S.tested?`<div class="plain-rule">${failCount} failing check${failCount===1?'':'s'} — the results screen says why each one failed.</div>`:'<div class="plain-rule">Run the tests first if you want the payment — the customer checks the result.</div>'}
      <div class="modal-actions"><button class="btn" id="to-test">To the Test Bench</button>${open&&!S.demoAttended?`<button class="btn cyan" id="rough-demo">Show unfinished work · 1h · operating cash ${money(operatingCashFor(1))}</button>`:''}<button class="btn" data-close>Back</button></div>
    </div>`);
    $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
    $('to-test').onclick=()=>{closeModal();autoWalk('test');};
    const rough=$('rough-demo');if(rough)rough.onclick=()=>presentDemo(false);
    return;
  }
  if(!S.demoAttended&&open){
    openModal(`<div class="modal-head"><div><div class="micro">${name} · closes ${clockText(deadline)}</div><h2 id="modal-title">Show the working build</h2><p>One hour. If the tested build works for this customer, ${plainMoney(t.sponsor)} is recorded for tonight’s settlement. Public release remains a separate decision.</p></div><button class="close" data-close>×</button></div>
    <div class="modal-body"><div class="plain-rule">While the hour passes, one fifteenth of today’s product revenue and daily AI cost accrues: ${money(operatingCashFor(1))}. The event payment remains pending until midnight.</div><div class="modal-actions"><button class="btn" id="skip-demo">Skip the event — release instead</button><button class="btn primary" id="do-demo">Show the build · 1h</button></div></div>`);
    $('modal').querySelector('[data-close]').onclick=closeModal;
    $('skip-demo').onclick=()=>{closeModal();showRelease();};
    $('do-demo').onclick=()=>presentDemo(true);
    return;
  }
  showRelease();
}

function showAlreadyReleased(){
  openModal(`<div class="modal-head"><div><div class="micro">Release recorded · ${timeText()}</div><h2 id="modal-title">You already released today’s build</h2><p>“${S.copy}”</p></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    <div class="plain-rule"><b>The decision is locked for today.</b> Users, payments, carried effects, and the deployed daily AI cost remain pending until the midnight receipt.</div>
    <div class="modal-actions"><button class="btn" data-close>Continue the day</button><button class="btn primary" id="released-settle">End day and reconcile</button></div>
  </div>`);
  $('released-settle').onclick=confirmEndDay;
}

function presentDemo(verified){
  if(S.demoAttended||S.time+1>24)return;
  const cashBefore=S.cash;advanceTime(1);S.demoAttended=true;closeModal();
  if(verified){
    const payment=task().sponsor+activityEventBonus();
    S.sponsorCash=payment;
    S.demoResult=`Working build shown — ${plainMoney(payment)} pending at midnight.`;
    showScene({cls:'stage',pages:[{speaker:eventName(task()).toUpperCase()+' · '+timeText(),title:'The customer accepts the result',html:`
      <p>${task().person}’s case works in front of them. The <b>${plainMoney(payment)}</b> payment is recorded and will post on the midnight receipt.${activityEventBonus()?` The community-demo contact added ${plainMoney(activityEventBonus())}.`:''}</p><p>Operating cash while presenting: ${plainMoney(cashBefore)} → ${plainMoney(S.cash)}.</p>
      <p>An accepted demo is not a public release. Nothing has been promised to the market yet.</p>`}],
      doneLabel:'Decide the release',onDone:showRelease});
  }else{
    S.demoResult='Unfinished work shown — feedback only, no payment.';
    showScene({cls:'stage',pages:[{speaker:eventName(task()).toUpperCase()+' · '+timeText(),title:'The failures are visible',html:`
      <p>The customer sees where it breaks. There is no payment and no surprise follower reward; the value is the concrete feedback already named by the failed tests.</p>`}],
      doneLabel:'Back to work',onDone:()=>{render();}});
  }
  render();
}

/* ============================================================
   Release — the promise and its exact tomorrow
   ============================================================ */
function hypeTomorrow(t){
  const refund=Math.round(t.hype.exposure*REFUND_SHARE);
  const rest=t.hype.exposure-refund;
  return {refund,rest};
}

function showRelease(){
  if(!allPassed()){showDoor();return;}
  const t=task();
  const {refund,rest}=hypeTomorrow(t);
  const fr=day7()?fitReadout(S.build.answers):null;
  const churnIfOpen=day7()&&t.ignoreUsers?(fr.lvl==='closed'?0:fr.lvl==='partial'?Math.ceil(t.ignoreUsers/2):t.ignoreUsers):0;
  const odds=Math.min(0.85,(t.hypeOdds||0.5)+(fr&&fr.lvl!=='closed'?0.15:0));
  const proved=S.testResults.filter(r=>r.pass&&!r.skipped&&r.slot!=='code').map(r=>r.name);
  openModal(`<div class="modal-head"><div><div class="micro">Launch positioning · ${t.app} · build v${S.version}</div><h2 id="modal-title">How wide do we launch?</h2><p>This is a portfolio choice, not a character judgment. A narrow claim converts less demand with low support exposure; a broad claim buys reach by inviting people into cases the build has not proven.</p></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    <div class="scope-grid">
      <div class="scope-box"><h3>What we proved works</h3><ul>${proved.map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="scope-box risk"><h3>Cases outside tonight’s test</h3><ul>${t.untested.map(x=>`<li>${displayFeature(x)}</li>`).join('')}</ul></div>
    </div>
    ${fr?`<div class="plain-rule" style="border-left-color:${fr.lvl==='closed'?'var(--green)':fr.lvl==='partial'?'var(--yellow)':'var(--red)'}"><b>${task().caseName}:</b> ${fr.verdict}${churnIfOpen?` If you ship this spec tonight, ${churnIfOpen} of the affected users still cancel — the case is theirs, and this spec leaves it open.`:''}</div>`:''}
    <div class="copy-grid">
      <div class="copy-card"><h3>Evidence-matched launch</h3><blockquote>“${honestClaim()}”</blockquote>
        <div class="receipt gain"><b>Recorded for midnight</b>
          <div class="r-row"><span>Audience</span><strong>tested segment only</strong></div>
          <div class="r-row"><span>Daily AI cost if deployed</span><strong>${plainMoney(S.aiDaily)} → ${plainMoney(aiDailyAfter(t.honest.ai))}</strong></div>
        </div>
        <div class="receipt"><b>Position</b><div class="r-row"><span>Targets only the segment demonstrated tonight. Lower reach; lower support load.</span></div></div>
        <button class="btn cyan" data-copy="honest">Launch to the proven segment</button></div>
      <div class="copy-card risky"><h3>Expansion launch</h3><blockquote>“${t.hypeCopy}”</blockquote>
        <div class="receipt gain"><b>Recorded for midnight</b>
          <div class="r-row"><span>Audience</span><strong>tested + untested cases</strong></div>
          <div class="r-row"><span>Preorders offered</span><strong>${plainMoney(t.hype.cash)} pending</strong></div>
          <div class="r-row"><span>Daily AI cost if deployed</span><strong>${plainMoney(S.aiDaily)} → ${plainMoney(aiDailyAfter(t.hype.ai))}</strong></div>
        </div>
        <div class="receipt bill"><b>The risk, exactly</b>
          <div class="r-row"><span>Chance someone hits an untested case ${day7()?'tomorrow':'this week'}</span><strong>${oddsWords(odds)}</strong></div>
          <div class="r-row"><span>If it happens: refunds</span><strong>−${plainMoney(refund)}</strong></div>
          <div class="r-row"><span>… users who leave, loudly</span><strong>−4</strong></div>
          <div class="r-row"><span>… and the rest of the promise (${plainMoney(rest)}) stays live over you</span></div>
          <div class="r-row"><span>If nobody does: nothing happens. This time.</span></div>
        </div>
        <button class="btn primary" data-copy="hype">Launch to the wider market</button></div>
    </div>
    <div class="plain-rule"><b>No market outcome posts yet.</b> Recording the launch takes 30 minutes and changes operating cash by ${money(operatingCashFor(0.5))}. New users, prior-day effects, event payment, preorder cash, and the deployed daily AI cost are reconciled together on the midnight receipt.</div>
  </div>`);
  $('modal').querySelector('[data-close]').onclick=closeModal;
  $('modal').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{
    if(b.dataset.copy==='hype'){
      openModal(`<div class="modal-head"><div><div class="micro">Confirm expansion positioning</div><h2 id="modal-title">Open the launch to untested cases?</h2><p>This copy recruits users outside tonight’s evidence: ${t.hypeVictim}.</p></div></div>
      <div class="modal-body"><div class="receipt bill"><b>Commercial exposure</b>
        <div class="r-row"><span>Odds someone takes it literally soon</span><strong>${oddsWords(odds)}</strong></div>
        <div class="r-row"><span>The bill if they do</span><strong>−${plainMoney(refund)} · −4 users · your next launch suffers</strong></div>
        <div class="r-row"><span>If they do not hit it</span><strong>$0 this cycle; the open case stays in the support pool</strong></div></div>
      <div class="modal-actions"><button class="btn" id="hype-back">Go back</button><button class="btn primary" id="hype-confirm">Take the expansion position</button></div></div>`,false);
      $('hype-back').onclick=showRelease;
      $('hype-confirm').onclick=()=>shipChoice('hype');
    } else shipChoice('honest');
  });
}

function shipChoice(type){
  const t=task();if(S.time+0.5>24)return;
  const cashBefore=S.cash;
  advanceTime(0.5);
  const fr=day7()?fitReadout(S.build.answers):null;
  S.shipped=true;S.copyType=type;S.copy=type==='honest'?honestClaim():t.hypeCopy;
  S.issueResolved=fr?fr.lvl==='closed':true;
  S.fitAtShip=fr?fr.lvl:'closed';
  const specBase=provenSegmentUsers(S.build.answers)+activityLaunchUsers(type,t);
  S.pendingLaunch={type,baseUsers:type==='honest'?specBase:t.hype.users,aiDelta:type==='honest'?t.honest.ai:t.hype.ai,
    preorder:type==='hype'?t.hype.cash:0,exposure:type==='hype'?t.hype.exposure:0,
    odds:Math.min(0.85,(t.hypeOdds||0.5)+(fr&&fr.lvl!=='closed'?0.15:0))};
  closeModal();
  $('world-message').textContent=`Release recorded at ${timeText()}: “${S.copy}”. Cash, users, prior effects, and the deployed daily AI cost post together at midnight.`;
  toast(`${type==='honest'?'Evidence-matched':'Expansion'} launch recorded · operating cash ${plainMoney(cashBefore)}→${plainMoney(S.cash)} · market accounts pending`);
  render();
}

/* ============================================================
   End of day → settlement
   ============================================================ */
function effectiveChurn(){
  const t=task()||(day7()?DAY7_TASKS.glare:null);if(!t||!t.ignoreUsers||S.issueResolved)return 0;
  if(!S.shipped)return t.ignoreUsers;
  return S.fitAtShip==='partial'?Math.ceil(t.ignoreUsers/2):t.ignoreUsers;
}
function confirmEndDay(){
  if(S.settled){showSettlementReceipt();return;}
  const t=task()||(day7()?DAY7_TASKS.glare:null),unresolved=t&&!S.issueResolved,remaining=Math.max(0,24-S.time);
  const left=remaining.toFixed(remaining%1?1:0);
  openModal(`<div class="modal-head"><div><div class="micro">End the day · ${timeText()}</div><h2 id="modal-title">Done for today?</h2><p>Ending now advances the clock to midnight and settles the books. Continuing the day returns to the garage with ${left} hour${remaining===1?'':'s'} left.</p></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    ${unresolved?`<div class="receipt bill"><b>Left ${S.shipped?'open by the shipped spec':'unresolved'} tonight</b><div class="r-row"><span>${S.shipped?`You shipped, but the spec leaves ${t.caseName||'the case'} ${S.fitAtShip==='partial'?'partly ':''}open.`:t.ignoreLine}</span></div>${effectiveChurn()?`<div class="r-row"><span>Users</span><strong>${S.users} → ${S.users-effectiveChurn()}</strong></div>`:''}</div>`:'<div class="plain-rule">Today’s chosen problem is closed by the spec you shipped.</div>'}
    <div class="plain-rule">While time remains you can revise a defective build, rerun tests, take any still-available outside activities, use coffee, present before the event closes, or release. Every action keeps its printed time and cash cost.</div>
    <div class="modal-actions"><button class="btn" data-close>Continue the day · ${left}h left</button><button class="btn primary" id="confirm-settle">End now and settle at midnight</button></div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('confirm-settle').onclick=settleDay;
}

function showSettlementReceipt(){
  if(!S.settled)return;
  renderSettlementReceipt(S._settlementRows||[],S._settlementChange||0,!!S._settlementBroke,task()||(day7()?DAY7_TASKS.glare:null));
}

function postPendingAccounts(){
  const p=S.pendingLaunch;
  if(S.sponsorCash)S.cash+=S.sponsorCash;
  if(!p)return;
  const usersBefore=S.users;
  const trustCut=S.trustPenalty?Math.round(p.baseUsers*S.trustPenalty):0;
  const usersAdded=Math.max(0,p.baseUsers-trustCut);
  const aiBefore=S.aiDaily;
  S.users+=usersAdded;
  S.aiDaily=Math.max(0.60,S.aiDaily+p.aiDelta);
  S.preorderCash=p.preorder;
  if(p.preorder)S.cash+=p.preorder;
  if(p.exposure)S.exposures.push({copy:S.copy,amount:p.exposure,odds:p.odds});
  S.launchSettlement={usersBefore,usersAdded,baseUsers:p.baseUsers,trustCut,aiBefore,aiAfter:S.aiDaily,preorder:p.preorder,type:p.type};
}

function settleDay(){
  if(S.settled)return;closeModal();
  if(S.time<24)advanceTime(24-S.time);
  const t=task()||(day7()?DAY7_TASKS.glare:null);
  const churn=effectiveChurn();
  if(churn){
    S.usersLost=churn;S.users=Math.max(0,S.users-churn);
    if(day7()){S.day7Ignored=true;S.day7IgnoredUsers=churn;}
  }
  postPendingAccounts();
  S.cash-=FIXED_BURN;S.fixedSpend=FIXED_BURN;S.settled=true;
  const change=S.cash-S.dayStartCash,broke=S.cash<=0;
  const rows=[
    ['Starting cash',plainMoney(S.dayStartCash)],
    ['User revenue accrued today',`+${plainMoney(S.opRevenue)}`],
    ['AI operating cost accrued today',`−${plainMoney(S.opAI)}`],
    ...(S.sponsorCash?[[`${eventName(t)} payment`,`+${plainMoney(S.sponsorCash)}`]]:[]),
    ...(S.preorderCash?[['Preorders from the promise',`+${plainMoney(S.preorderCash)}`]]:[]),
    ...(S.refundPaid?[['Refunds from yesterday’s promise',`−${plainMoney(S.refundPaid)}`]]:[]),
    ...(S.purchaseSpend?[['AI credits bought with cash',`−${plainMoney(S.purchaseSpend)}`]]:[]),
    ...(S.activitySpend?[[`Outside activities (${activities().map(a=>a.name).join(', ')}) · direct cost`,`−${plainMoney(S.activitySpend)}`]]:[]),
    ...(S.coffeeSpend?[['Coffee',`−${plainMoney(S.coffeeSpend)}`]]:[]),
    ...(S.launchSettlement?[[`Launch users (${S.launchSettlement.usersBefore} already carried into today; ${S.launchSettlement.baseUsers} market response${S.launchSettlement.trustCut?` − ${S.launchSettlement.trustCut} trust adjustment`:''})`,`+${S.launchSettlement.usersAdded} users`],
      ['Deployed daily AI cost',`${plainMoney(S.launchSettlement.aiBefore)} → ${plainMoney(S.launchSettlement.aiAfter)} · next full day ${money(S.launchSettlement.aiAfter-S.launchSettlement.aiBefore)}`]]:[]),
    ['Rent + tools at midnight',`−${plainMoney(S.fixedSpend)}`]
  ];
  S._settlementRows=rows;S._settlementChange=change;S._settlementBroke=broke;
  renderSettlementReceipt(rows,change,broke,t);
}

function renderSettlementReceipt(rows,change,broke,t){
  openModal(`<div class="modal-head"><div><div class="micro">Midnight · Day ${S.day}</div><h2 id="modal-title">${broke?'The money ran out':'The day, reconciled'}</h2><p>${broke?'Midnight costs cleared the last of the cash.':'Same numbers you were shown when you chose — now on the receipt.'}</p></div></div>
  <div class="modal-body">
    <table class="settle-table">${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}<tr class="total"><td>Cash change / closing cash</td><td>${money(change)} · ${plainMoney(S.cash)}</td></tr></table>
    ${S.usersLost?`<div class="receipt bill"><b>The skipped problem, as promised</b><div class="r-row"><span>${t.ignoreLine}</span></div><div class="r-row"><span>Users</span><strong>${S.users+S.usersLost} → ${S.users}</strong></div></div>`:''}
    ${activities().map(a=>`<div class="impact"><b>Outside activity · ${a.name}</b>${a.effect}</div>`).join('')}
    ${S.demoAttended?`<div class="impact"><b>${eventName(t)}</b>${S.demoResult}</div>`:''}
    <div class="brief-grid">
      <div class="brief-card"><div class="k">Tomorrow’s users</div><strong>${S.users}</strong><p>${S.usersLost?`${S.usersLost} left over the skipped problem.`:S.issueResolved?'The chosen problem is fixed for them.':'No losses tonight.'}</p></div>
      <div class="brief-card"><div class="k">Tomorrow’s product result</div><strong>${fmtDay(dailyProductResult())}</strong><p>${fmtDay(dailyRevenue())} from users − ${plainMoney(S.aiDaily)}/day in AI.</p></div>
      <div class="brief-card ${expTotal()?'danger':'opportunity'}"><div class="k">Launch exposure</div><strong>${expTotal()?`${plainMoney(expTotal())} open`:'Contained'}</strong><p>${expTotal()?S.exposures.map(e=>`“${e.copy}” (${plainMoney(e.amount)})`).join(' · ')+` — ${S.day===7?`${oddsWords(S.exposures[0]?.odds||0.5)} an untested case enters support tomorrow; if it does, ${plainMoney(Math.round(expTotal()*REFUND_SHARE))} bills in the morning and the rest stays open.`:'one more market cycle resolves it at the wrap.'}`:S.copy?`“${S.copy}” stayed inside the tested segment.`:'No launch position taken.'}</p></div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="record-after">Company record</button>
      ${broke?'<button class="btn primary" id="to-broke">Continue</button>':(S.day===7?'<button class="btn primary" id="next-day">Sleep → Day 8</button>':'<button class="btn primary" id="to-wrap">Sleep → the week wrap</button>')}
    </div>
  </div>`,false);
  $('record-after').onclick=()=>showRecord('products');
  if(broke){$('to-broke').onclick=showRunwayZero;}
  else if(S.day===7){$('next-day').onclick=startDay8;}
  else {$('to-wrap').onclick=showWrap;}
  render();
}

/* ============================================================
   Day 8 morning — every overnight cause gets its own page
   ============================================================ */
function startDay8(){
  closeModal();
  // carry over
  S.previousCopy=S.copy;S.previousCopyType=S.copyType;S.previousTaskId=S.selectedTaskId;
  // sample the promise: does anyone actually hit an untested case tonight?
  const rngNight=mulberry32((Date.now()^0xBEEF)>>>0);
  let refund=0;S._blewOvernight=false;
  S.exposures.forEach(e=>{
    if(rngNight()<e.odds){e.blown=true;S._blewOvernight=true;refund+=Math.round(e.amount*REFUND_SHARE);}
    else{e.odds=Math.min(0.9,e.odds+0.15);}
  });
  // overnight effects
  S.day=8;S.time=9;S.focus=4;
  S.aiDaily+=HIKE;
  if(refund){S.users=Math.max(0,S.users-4);S.trustPenalty=0.4;S.exposures.forEach(e=>{if(e.blown)e.amount-=Math.round(e.amount*REFUND_SHARE);});}
  // reset day state
  S.selectedTaskId='';S.answers={};S.qIndex=0;S.selected=[];S.reviewedSlots=[];S.inviteShown=false;
  S.build=null;S.tested=false;S.testResults=[];S.version=0;S.shipped=false;S.issueResolved=false;S.pendingLaunch=null;S.launchSettlement=null;
  S.demoAttended=false;S.demoResult='';S.activityIds=[];S.activitySpend=0;
  S.morningDone=false;S.settled=false;delete S._settlementRows;delete S._settlementChange;delete S._settlementBroke;
  S.dayStartCash=S.cash;S.dayStartAiDaily=S.aiDaily;S.opRevenue=0;S.opAI=0;S.sponsorCash=0;S.preorderCash=0;S.coffeeSpend=0;S.purchaseSpend=0;S.fixedSpend=0;S.usersLost=0;
  S.pos={x:50,y:70};S.facing='front';$('player').style.left=`${S.pos.x}%`;$('player').style.top=`${S.pos.y}%`;applyFacing();
  // charge the refund AFTER dayStartCash so it reconciles as a Day-8 line item
  S._morningRefund=refund;
  if(refund){S.cash-=refund;S.refundPaid=refund;}
  render();
  showDay8Morning();
}

function showDay8Morning(){
  const pages=[];
  // page 1: the price rise (always)
  const before=(S.aiDaily-HIKE),after=S.aiDaily;
  pages.push({speaker:'07:12 · EMAIL',title:'ORACLE Corp raised its prices',html:`
    <div class="phone-msg"><span class="from">ORACLE CORP BILLING</span><span class="when">07:12</span>
    <p>Effective immediately, inference pricing at your tier rises. Thank you for building with ORACLE.</p></div>
    <div class="receipt bill"><b>What that does to you</b>
      <div class="r-row"><span>Daily AI operating cost</span><strong>${plainMoney(before)} → ${plainMoney(after)}</strong></div>
      <div class="r-row"><span>Increase</span><strong>${plainMoney(HIKE)}/day</strong></div>
    </div>`,
    aside:`The higher daily AI cost now appears in the HUD, every timed-action preview, the full calculation, and the midnight receipt.`});
  // page 2: yesterday's promise / neglect, if any
  if(S._morningRefund){
    const t=DAY7_TASKS[S.previousTaskId];
    pages.push({speaker:'08:40 · SUPPORT INBOX',title:'The promise came due',html:`
      <div class="phone-msg"><span class="from">SUPPORT</span><span class="when">08:40</span>
      <p>Overnight case: ${t.hypeVictim}. It guessed. She wants her money back — and she posted about it.</p></div>
      <div class="receipt bill"><b>Yesterday you posted: “${S.previousCopy}”</b>
        <div class="r-row"><span>Refunds processed</span><strong>−${plainMoney(S._morningRefund)}</strong></div>
        <div class="r-row"><span>Users gone</span><strong>−4</strong></div>
        <div class="r-row"><span>Still owed at the wrap</span><strong>−${plainMoney(expTotal())}</strong></div>
      </div>`,
      aside:'The launch reached beyond the tested segment. This is the same exposure shown before confirmation; the next launch now converts fewer people until confidence recovers.'});
  } else if(!S._blewOvernight&&S.exposures.length){
    const e=S.exposures[0];
    pages.push({speaker:'08:40 · OVERNIGHT NUMBERS',title:'The quiet morning',html:`
      <div class="phone-msg"><span class="from">DASHBOARD</span><span class="when">08:40</span>
      <p>New signups overnight. Zero refunds. Nobody tried the things you promised and didn\u2019t build. Not yet.</p></div>
      <div class="receipt"><b>Still on the books</b>
        <div class="r-row"><span>\u201c${e.copy}\u201d</span><strong>${plainMoney(e.amount)}</strong></div>
        <div class="r-row"><span>Odds someone hits it before the wrap</span><strong>${oddsWords(e.odds)}</strong></div>
      </div>`,
      aside:'This is how it usually goes. The promise didn\u2019t cost anything today \u2014 it just kept accruing odds.'});
  } else if(S.day7Ignored){
    pages.push({speaker:'08:40 · MESSAGE',art:null,title:'The skipped problem, this morning',html:`
      <div class="phone-msg"><span class="from">USER_0047</span><span class="when">08:40</span>
      <p>${S.day7IgnoredUsers} people in my accessibility group cancelled this morning. same shiny-label thing. grandma’s still waiting on you.</p></div>`,
      aside:'The board said this yesterday: skip it and they cancel. They did.'});
  } else if(S.previousCopyType==='honest'){
    pages.push({speaker:'08:40 · MESSAGE',title:'It held',html:`
      <div class="phone-msg"><span class="from">USER_0047</span><span class="when">08:40</span>
      <p>grandma scanned her pills this morning. it said “too shiny — try by the window.” she did. right dose. thank you.</p></div>
      <div class="phone-msg"><span class="from">USER_0047</span><span class="when">08:41</span>
      <p>her pharmacist asked what app that was. sent him the link.</p></div>`,
      aside:'The release targeted the proven segment. The fix created a referral inside that segment. (+3 users found you overnight.)'});
  }
  showScene({art:S._morningRefund||S.day7Ignored||S.previousCopyType!=='honest'?null:ASSET.grandma,artAlt:'Grandma',pages,doneLabel:'Open the product board',
    onDone:()=>{
      if(S.previousCopyType==='honest'&&!S.day7Ignored)S.users+=3;
      S._morningRefund=0;S.morningDone=true;showTaskBoard();render();
    }});
}

/* ============================================================
   Week wrap — everything owed comes due inside the slice
   ============================================================ */
function showWrap(){
  closeModal();
  const rngWrap=mulberry32((Date.now()^0xCAFE)>>>0);
  const blownEntries=[],carriedEntries=[];
  S.exposures.filter(e=>e.amount>0).forEach(e=>{
    if(rngWrap()<e.odds)blownEntries.push(e);else carriedEntries.push(e);
  });
  const owed=blownEntries.reduce((n,e)=>n+e.amount,0);
  if(blownEntries.length)S.users=Math.max(0,S.users-4);
  S.cash-=owed;S.exposures=[];
  const broke=S.cash<=0;
  const productResult=dailyProductResult();
  const dailyNet=productResult-FIXED_BURN;
  const week=fiveDayCashProjection(S.cash,dailyNet);
  openModal(`<div class="modal-head"><div><div class="micro">The week wrap · after Day 8</div><h2 id="modal-title">${broke?'The wrap cleared you out':'Where the week leaves you'}</h2><p>Everything still on the books comes due here — nothing quietly vanishes when the slice ends.</p></div></div>
  <div class="modal-body">
    <table class="settle-table">
      <tr><td>Cash after Day 8</td><td>${plainMoney(S.cash+owed)}</td></tr>
      ${blownEntries.map(e=>`<tr><td>The promise got tested — “${e.copy}”</td><td>−${plainMoney(e.amount)}</td></tr>`).join('')}
      ${carriedEntries.map(e=>`<tr><td>Never got tested — “${e.copy}” (${plainMoney(e.amount)} of risk, unbilled)</td><td>$0.00</td></tr>`).join('')}
      ${blownEntries.length?`<tr><td>Users who hit the untested cases</td><td>−4 users</td></tr>`:''}
      <tr class="total"><td>Cash at the wrap</td><td>${plainMoney(S.cash)}</td></tr>
    </table>
    <div class="brief-grid">
      <div class="brief-card"><div class="k">Users</div><strong>${S.users}</strong><p>started the week at 84.</p></div>
      <div class="brief-card"><div class="k">Daily net cash change</div><strong>${fmtDay(dailyNet)}</strong><p>${fmtDay(productResult)} product result − ${plainMoney(FIXED_BURN)}/day fixed costs · runway ${Math.max(0,runway()).toFixed(1)} days.</p></div>
      <div class="brief-card ${week>0?'opportunity':'danger'}"><div class="k">Cash after five similar days</div><strong>${plainMoney(Math.max(0,week))}</strong><p>${week>0?`${plainMoney(S.cash)} + (${money(dailyNet)} × 5 days) = ${plainMoney(week)}.`:`${plainMoney(S.cash)} + (${money(dailyNet)} × 5 days) falls below $0; runway ends first.`} Assumes users, daily AI cost, and fixed costs do not change.</p></div>
    </div>
    ${carriedEntries.length?`<div class="plain-rule" style="border-left-color:var(--yellow)"><b>Unresolved market exposure:</b> ${carriedEntries.map(e=>`\u201c${e.copy}\u201d`).join(' and ')} did not encounter a breaking case in this slice. The reach was real; so is the open support surface carried into the next cycle.</div>`:''}
    <div class="lesson"><b>The playable loop:</b> choose a person and a problem; define behaviors; spend prepaid credits on an implementation; test it against the incident; use any outside activities that fit the remaining day; release to a chosen market; then carry the exact cash, users, costs, and unresolved cases into tomorrow.</div>
    <div class="modal-actions"><button class="btn" id="wrap-record">Company record</button><button class="btn primary" id="wrap-replay">${broke?'See the ending':'Replay from Day 7'}</button></div>
  </div>`,false);
  $('wrap-record').onclick=()=>showRecord('promises');
  $('wrap-replay').onclick=broke?showRunwayZero:resetAll;
  render();
}

function showRunwayZero(){
  S.gameOver=true;
  showScene({cls:'ending',pages:[{speaker:'AFTER MIDNIGHT',title:'RUNWAY ZERO',html:`
    <p>The obligations cleared what was left. The garage goes dark; the services suspend at dawn.</p>
    <p>Not one failed test did this — tests never do. The money simply ran out of days.</p>`}],
    doneLabel:'Replay from Day 7',onDone:resetAll});
}

/* ============================================================
   Record / calculation
   ============================================================ */
function showRecord(tab){
  if(tab)S.recordTab=tab;
  const tabs=[['products','Product'],['builds','Builds'],['promises','Promises'],['people','People']];
  let rows=[];const t=task();
  if(S.recordTab==='products')rows=[
    ['Active product',`ClearRead · ${S.users} users generate ${fmtDay(dailyRevenue())} · daily AI cost ${plainMoney(S.aiDaily)} · product result ${fmtDay(dailyProductResult())}.`],
    ['Today’s task',t?`${t.title} — ${t.person}. ${S.issueResolved?'Resolved in the released scope.':S.build?'Build in progress.':'Not started.'}`:'None chosen yet.'],
    ['AI credits',`${Math.floor(S.credits)} ⚡ prepaid. Buying more costs real cash: 500 ⚡ for $125.${S.purchaseSpend?` Today’s purchases moved ${plainMoney(S.purchaseSpend)} out of cash.`:''}`]
  ];
  if(S.recordTab==='builds')rows=S.build?[
    ['Saved build',`v${S.version} · ${displayFeature(S.build.kind)} build · ${S.build.cost} ⚡.`],
    ['Instruction',`“${S.build.instruction}”`],
    ['Code check',S.tested?(S.build.defect?'defect found':'clean'):'not tested yet'],
    ['Tests',S.tested?`${S.testResults.filter(r=>r.pass).length}/${S.testResults.length} passed`:'not run']
  ]:[['Saved build','None today.']];
  if(S.recordTab==='promises')rows=[
    [eventName(t),S.demoAttended?S.demoResult:S.time+1>eventDeadline(t)?`Closed at ${clockText(eventDeadline(t))} without a working presentation.`:`Open until ${clockText(eventDeadline(t))}.`],
    ['Public promise',S.copy?`“${S.copy}”`:'Nothing promised today.'],
    ['Pending at midnight',S.pendingLaunch&&!S.settled?`${S.pendingLaunch.type==='honest'?'Evidence-matched':'Expansion'} position recorded. Users, ${S.pendingLaunch.preorder?'preorders, ':''}trust, carried effects, and daily AI cost have not posted yet.`:'Nothing pending.'],
    ['On the books',expTotal()?S.exposures.filter(e=>e.amount>0).map(e=>`${plainMoney(e.amount)} owed against “${e.copy}”`).join('; ')+` — ${S.day===7?'part comes due next morning, the rest at the week wrap.':'due at the week wrap.'}`:'Nothing owed.'],
    ['Yesterday',S.previousCopy?`“${S.previousCopy}” (${S.previousCopyType==='hype'?'expansion segment — support case resolved this morning':'proven segment'}).`:'—']
  ];
  if(S.recordTab==='people')rows=[
    ['Founder (you)','Chooses the problem, writes the instruction, decides the promise.'],
    ['Life outside the garage',activities().length?activities().map(a=>`${a.name} at ${a.place}: ${a.effect}`).join(' · '):'No outside activities yet today. The map remains available while time and cash allow.'],
    ['USER_0047','The person the company exists for. His grandma hit the glare failure the night before Day 7.']
  ];
  openModal(`<div class="modal-head"><div><div class="micro">Company record</div><h2 id="modal-title">Product, builds, promises, people</h2></div><button class="close" data-close>×</button></div>
  <div class="modal-body"><div class="record-tabs">${tabs.map(x=>`<button class="record-tab ${S.recordTab===x[0]?'active':''}" data-record-tab="${x[0]}">${x[1]}</button>`).join('')}</div>
  ${rows.map(r=>`<div class="record-row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
  <div class="modal-actions"><button class="btn primary" data-close>Back</button></div></div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=S.settled?showSettlementReceipt:closeModal);
  $('modal').querySelectorAll('[data-record-tab]').forEach(b=>b.onclick=()=>showRecord(b.dataset.recordTab));
}

function showCalculation(){
  const rev=dailyRevenue(),ai=S.aiDaily,net=rev-ai-FIXED_BURN;
  const pendingDaily=S.pendingLaunch?aiDailyAfter(S.pendingLaunch.aiDelta):null;
  openModal(`<div class="modal-head"><div><div class="micro">The full calculation</div><h2 id="modal-title">How a day turns into money</h2><p>Every number below uses the same daily unit shown in the HUD and settlement receipt.</p></div><button class="close" data-close>×</button></div>
  <div class="modal-body"><table class="settle-table">
    <tr><td>${S.users} users × ${plainMoney(REV_PER_USER_DAY)} per user per day</td><td>+${plainMoney(rev)}</td></tr>
    <tr><td>Daily AI operating cost</td><td>−${plainMoney(ai)}</td></tr>
    <tr><td>Daily product result before fixed costs</td><td>${money(rev-ai)}</td></tr>
    <tr><td>Rent + tools at midnight</td><td>−${plainMoney(FIXED_BURN)}</td></tr>
    <tr class="total"><td>A day like today</td><td>${money(net)}</td></tr></table>
  ${pendingDaily!==null&&!S.settled?`<div class="plain-rule"><b>Pending deployment:</b> the recorded launch changes daily AI cost from ${plainMoney(S.aiDaily)} to ${plainMoney(pendingDaily)} at midnight. It has not changed this calculation yet.</div>`:''}
  <div class="plain-rule"><b>Time is economic.</b> The 15-hour playable day runs from 09:00 to midnight. A one-hour action accrues exactly 1/15 of daily user revenue and daily AI cost. A cost optimization changes the daily AI total only after it is tested, released, and reconciled.</div>
  <div class="plain-rule">AI credits (⚡) are separate: a prepaid balance for builds and tests. They only touch cash at the moment you buy more (500 ⚡ = $125).</div>
  <div class="modal-actions"><button class="btn" id="preview-broke">Preview the runway-zero ending</button><button class="btn primary" data-close>Got it</button></div></div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('preview-broke').onclick=()=>{openModal(`<div class="scene ending"><div class="scene-box wide"><div class="speaker">REVIEW-ONLY PREVIEW</div><h2 id="modal-title">RUNWAY ZERO</h2><p>If closing cash ever reaches $0, the company ends — from economics, never from one failed test.</p><div class="modal-actions"><button class="btn primary" id="back-calc">Back</button></div></div></div>`,false);$('back-calc').onclick=showCalculation;};
}

/* ============================================================
   Input & init
   ============================================================ */
function resetAll(){closeModal();S=initialState();$('player').style.left=`${S.pos.x}%`;$('player').style.top=`${S.pos.y}%`;startPlayerAnimation('idle',true);applyFacing();render();startMorning();}

function init(){
  document.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>stationAction(b.dataset.station));
  $('record').onclick=()=>showRecord();
  $('economy-details').onclick=showCalculation;
  $('end-day').onclick=confirmEndDay;
  startPlayerAnimation('idle',true);applyFacing();render();startMorning();
}
window.__vcsPrototype={getState:()=>JSON.parse(JSON.stringify(S)),reset:resetAll};
init();
