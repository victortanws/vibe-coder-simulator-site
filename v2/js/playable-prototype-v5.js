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
  dev:'ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png',
  oracleBuild:'assets/scenes/founder-vibe-coding/pc-01-vibe-code-first-app-success-v1.png',
  alaric:'assets/scenes/characters/CAST-34-alaric-kade/censored/dialogue/cast-34-alaric-kade-explaining-v1.png',
  dorian:'assets/scenes/characters/CAST-07-dorian/censored/directional/cast-07-dorian-facing-right-v1.png',
  summit:'assets/scenes/BG-11-summit-table.png',
  grandma:'ChatGPT/R-assets/cast/CAST-27/cast-27-grandmother-bust-v1.png',
  taskArt:'ChatGPT/UI-UX/cards/PROTO-ART-06/proto-art-06-task-card-illustrations-v1.png'
};

/* ---------- economy constants ---------- */
const REV_PER_USER_DAY = 0.09; // one active user contributes this much per day
const FIXED_BURN   = 105;      // rent + tools at midnight
const DAY8_MULTIPLIER = 1.50;  // Day 8 raises the unit price of deployed inference
const CREDIT_PACK = 200;
const DAY7_PACK_PRICE = 120;
const DAY8_PACK_PRICE = 180;
const OPERATING_HOURS = 15;    // 09:00–24:00; daily totals accrue evenly while time passes
const REFUND_SHARE = 0.4;      // slice of exposure billed the next morning

const fmtDay = n => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(2)}/day`;
const money = n => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;
const plainMoney = n => `$${n.toFixed(2)}`;
const displayFeature = value => value ? value.charAt(0).toUpperCase()+value.slice(1) : '';
const isNewProduct = t => /^New app\b/i.test(t.type);
const productScope = t => `${isNewProduct(t)?'New product':'Existing product'} · ${t.app}`;
const taskButtonLabel = t => isNewProduct(t)?`Prototype ${t.app}`:`Work on this ${t.app} problem`;

const ACTIVITIES = Object.create(null);
const ACTIVITY_SYSTEM_SPEAKERS = new Set(['NARRATOR','SYSTEM']);

class ActivityAuthoringError extends TypeError{
  constructor(issues){super(`Activity needs author input:\n${issues.map(issue=>`- ${issue.prompt}`).join('\n')}`);this.name='ActivityAuthoringError';this.issues=issues;}
}

function splitSentences(text){
  return String(text||'').trim().match(/[^.!?]+[.!?]+(?:[”’"])?|[^.!?]+$/g)?.map(part=>part.trim()).filter(Boolean)||[];
}

function compileActivityScript(script,{maxWords=34}={}){
  const source=Array.isArray(script)?script.join('\n'):String(script||'');
  const beats=[];
  source.split(/\n+/).map(line=>line.trim()).filter(Boolean).forEach((line,index)=>{
    if(line==='---'){beats.push({break:true});return;}
    const match=line.match(/^([\p{L}\p{N}_ .'-]{1,32}):\s*(.+)$/u);
    const speaker=match?match[1].trim():'NARRATOR';
    const text=match?match[2].trim():line;
    let current='';
    splitSentences(text).forEach(sentence=>{
      const next=`${current} ${sentence}`.trim();
      if(current&&next.split(/\s+/).length>maxWords){beats.push({speaker,text:current,sourceLine:index+1});current=sentence;}
      else current=next;
    });
    if(current)beats.push({speaker,text:current,sourceLine:index+1});
  });
  const screens=[];
  beats.forEach(beat=>{
    if(beat.break){if(screens.length)screens[screens.length-1].explicitBreak=true;return;}
    const previous=screens[screens.length-1];
    const canMerge=previous&&!previous.explicitBreak&&previous.speaker===beat.speaker&&(previous.text+' '+beat.text).split(/\s+/).length<=maxWords;
    if(canMerge)previous.text=`${previous.text} ${beat.text}`;
    else screens.push({...beat});
  });
  return screens.map((screen,index)=>Object.freeze({...screen,id:`screen-${index+1}`}));
}

function activityAuthoringIssues(definition){
  const issues=[];
  const ask=(field,prompt)=>issues.push({field,prompt});
  if(!definition||typeof definition!=='object'){ask('definition','Provide an activity definition.');return issues;}
  if(!String(definition.id||'').trim())ask('id','Provide a stable activity id, such as “design-museum”.');
  if(!String(definition.name||'').trim())ask('name','What is the player-facing activity name?');
  if(!String(definition.location||'').trim())ask('location','What is the location name?');
  if(!(definition.durationMinutes>0))ask('durationMinutes','How many minutes does the activity take?');
  if(!String(definition.script||'').trim())ask('script','Provide the authored script. Use “SPEAKER: dialogue” on each line and “---” for an intentional screen break.');
  if(!Array.isArray(definition.eventTable)||!definition.eventTable.length)ask('eventTable','Paste a JSON array with at least one response row: [{"id":"result","weight":1,"title":"Result","script":"SYSTEM: What happened.","effects":[]}].');
  const presentation=definition.presentation||{};
  if(!presentation.background&&!presentation.backgrounds?.length&&!presentation.inheritWorldBackground)ask('presentation.background','Provide an approved background asset or an approved background pool, or explicitly set inheritWorldBackground: true.');
  const scriptSpeakers=compileActivityScript(definition.script).map(screen=>screen.speaker).filter(speaker=>!ACTIVITY_SYSTEM_SPEAKERS.has(speaker.toUpperCase()));
  const castNames=new Set((presentation.characters||[]).map(character=>String(character.name||character.id||'').toUpperCase()));
  [...new Set(scriptSpeakers)].filter(speaker=>!castNames.has(speaker.toUpperCase())).forEach(speaker=>ask(`presentation.characters.${speaker}`,`Provide an approved character asset for ${speaker}, or rewrite that line as NARRATOR/SYSTEM if the character remains offscreen.`));
  return issues;
}

function promptForActivityInputs(definition,issues){
  if(typeof window==='undefined'||typeof window.prompt!=='function')throw new ActivityAuthoringError(issues);
  const draft={...(definition||{}),presentation:{...definition?.presentation}};
  for(const issue of issues){
    const answer=window.prompt(issue.prompt,'');
    if(answer===null)throw new ActivityAuthoringError(issues);
    if(issue.field==='script')draft.script=answer;
    else if(issue.field==='presentation.background')draft.presentation.background=answer;
    else if(issue.field.startsWith('presentation.characters.')){
      const name=issue.field.split('.').pop();
      draft.presentation.characters=[...(draft.presentation.characters||[]),{id:name.toLowerCase().replace(/\W+/g,'-'),name,asset:answer,side:'left'}];
    } else if(issue.field==='durationMinutes')draft.durationMinutes=Number(answer);
    else if(issue.field==='eventTable'){
      try{draft.eventTable=JSON.parse(answer);}catch{throw new ActivityAuthoringError([{field:'eventTable',prompt:'The response table was not valid JSON. Paste an array of rows with id, weight, title, script and effects.'}]);}
    }
    else draft[issue.field]=answer;
  }
  return draft;
}

function addActivity(input,options={promptForMissing:true}){
  let definition=input;
  let issues=activityAuthoringIssues(definition);
  if(issues.length&&options.promptForMissing){definition=promptForActivityInputs(definition,issues);issues=activityAuthoringIssues(definition);}
  if(issues.length)throw new ActivityAuthoringError(issues);
  if(!/^[a-z0-9-]+$/.test(definition.id))throw new TypeError('Activity id must be a stable slug.');
  if(ACTIVITIES[definition.id])throw new TypeError(`Duplicate activity id: ${definition.id}`);
  const cost=definition.cost||{};
  if((cost.cash||0)<0||(cost.energy||0)<0)throw new TypeError(`Activity costs cannot be negative: ${definition.id}.`);
  const allowedEffects=new Set(['energy','cash','users','lesson','test-unlock']);
  const normalizeEffect=effect=>{
    if(!allowedEffects.has(effect.type))throw new TypeError(`Unknown activity effect ${effect.type} in ${definition.id}.`);
    if(!['immediate','settlement'].includes(effect.timing))throw new TypeError(`Invalid activity effect timing in ${definition.id}.`);
    return Object.freeze({...effect});
  };
  const eventTable=definition.eventTable.map(row=>{
    if(!/^[a-z0-9-]+$/.test(row.id||'')||!(Number(row.weight)>0)||!String(row.script||'').trim())throw new TypeError(`Activity ${definition.id} has an invalid response-table row.`);
    return Object.freeze({...row,weight:Number(row.weight),screens:Object.freeze(compileActivityScript(row.script)),effects:Object.freeze((row.effects||[]).map(normalizeEffect))});
  });
  const presentation={inheritWorldBackground:false,sceneClass:'',background:'',backgrounds:[],characters:[],...definition.presentation};
  const normalized=Object.freeze({
    ...definition,
    cost:Object.freeze({cash:Number(cost.cash||0),energy:Number(cost.energy||0)}),
    preview:Object.freeze({...definition.preview}),
    scriptScreens:Object.freeze(compileActivityScript(definition.script)),
    presentation:Object.freeze({
      ...presentation,
      backgrounds:Object.freeze([...(presentation.backgrounds||[])]),
      assets:Object.freeze((presentation.assets||[]).map(asset=>Object.freeze({
        ...asset,
        tags:Object.freeze([...(asset.tags||[])]),
        composition:Object.freeze({...asset.composition})
      }))),
      characters:Object.freeze((presentation.characters||[]).map(character=>Object.freeze({...character})))
    }),
    eventTable:Object.freeze(eventTable)
  });
  ACTIVITIES[definition.id]=normalized;
  return normalized;
}

const registerActivity=definition=>addActivity(definition,{promptForMissing:false});
const activityDefinitions=Array.isArray(window.VCS_ACTIVITY_DATA)?window.VCS_ACTIVITY_DATA:[];
if(!activityDefinitions.length)throw new Error('Activity catalogue did not load. Generate js/activity-data.generated.js from data/activities.json.');
activityDefinitions.forEach(registerActivity);

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

/* The public ClearRead route compresses the same four observable requirements
   into two consequential decisions. This is the promoted ORACLE Studio V2
   presentation; the surrounding garage, ledger and settlement remain V1. */
const ORACLE_V2_QUESTIONS = [
  {id:'reading',title:'What should ClearRead say aloud?',options:[
    {id:'exact',label:'Only a complete dosage',note:'If glare hides any part, explain that it cannot read the dose.',answers:{purpose:'exact',condition:'glare'},lines:['Read the dosage only when the complete line is visible.','When glare hides any part of the dosage, explain that it cannot be read.']},
    {id:'confirmed',label:'Only text it can confirm',note:'Speak visible words, but never invent what is hidden.',answers:{purpose:'confirmed',condition:'unreadable'},lines:['Read only text ClearRead can confirm from the photo.','When critical text is hidden, never fill in the missing words.']}
  ]},
  {id:'recovery',title:'What should happen when it is unsure?',options:[
    {id:'fresh',label:'Start a completely fresh scan',note:'Discard the old photo before reading the new one.',answers:{proof:'fresh',fallback:'silent'},lines:['A new photo must start a completely new reading.','Until the complete dosage is visible, stay silent rather than guess.']},
    {id:'retake',label:'Ask for another photo',note:'Request a clearer image and wait for it.',answers:{proof:'retake',fallback:'silent'},lines:['When the dosage is incomplete, ask for another photo.','Until the complete dosage is visible, stay silent rather than guess.']}
  ]}
];

const ORACLE_V2_COSTS = Object.freeze({build:{credits:80,hours:1,energy:1},test:{credits:20,hours:.5,energy:0},revise:{credits:36,hours:.75,energy:1}});
const ORACLE_DAY8_COSTS = Object.freeze({build:{credits:180,hours:1,energy:1},test:{credits:20,hours:.5,energy:0}});
const ORACLE_DAY8_OPTIONS = Object.freeze([
  {id:'local',label:'Keep label reading available on the phone',note:'Use a smaller on-device model when the clinic loses its connection.',line:'When the connection drops, read supported labels with the on-device model.'},
  {id:'decline',label:'Explain that ClearRead is offline',note:'Do not attempt a reading until the clinic reconnects.',line:'When the connection drops, explain that label reading is unavailable.'}
]);
const oracleV2Lines = () => ORACLE_V2_QUESTIONS.flatMap(q=>q.options.find(o=>Object.entries(o.answers).every(([key,value])=>S.oracleV2.answers[key]===value))?.lines||[]);
const oracleV2SecondPhotoPasses = () => S.oracleV2.answers.proof==='fresh';

const DAY7_TASKS = {
  glare:{
    id:'glare', app:'ClearRead', art:0,
    person:'USER_0047\u2019s grandma', type:'Read-aloud app \u00b7 84 users',
    title:'Stop wrong reads on shiny labels',
    problem:'Last night ClearRead read a glossy medicine label wrong, out loud, with total confidence. She almost took a double dose.',
    takes:'Two decisions become four saved behaviors \u00b7 about 3\u20134 hours to build, test, and revise.',
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

/* The public two-day slice has one supported customer problem per day. The
   larger task catalog remains available to internal experiments, but exposing
   it here would route players back into superseded ORACLE interfaces. */
const PUBLIC_DAY7_TASKS = Object.freeze({glare:DAY7_TASKS.glare});
const PUBLIC_DAY8_TASKS = Object.freeze({offline:DAY7_TASKS.offline});

const SLOT_QUESTION = {goal:'What should it do?',context:'When does it happen?',success:'How do we know it worked?',guardrail:'What must it never do?'};
const questionFor = (t,slot) => t?.questions?.[slot] || QUESTIONS.find(q=>q.slot===slot)?.q || SLOT_QUESTION[slot];

/* ============================================================
   State
   ============================================================ */
const initialState = () => ({
  day:7, time:9, cash:700, credits:80, energy:4, users:84,
  aiDaily:2.25,
  inflationMultiplier:1,
  // pipeline
  sceneQueue:[], scenesSeen:{},
  morningDone:false, selectedTaskId:'', inviteShown:false, oracleIntroDone:false,
  answers:{}, qIndex:0,                      // Day 7 staged Q&A
  selected:[], reviewedSlots:[], // Day 8 uses the same four-question interview
  build:null, tested:false, testResults:[], version:0, productVersion:'0.7.4',
  oracleV2:{stage:'dialogue',question:0,answers:{},behaviors:[],secondPhoto:null,diagnosis:'',patch:'',evidence:[],release:null},
  oracleDay8:{stage:'question',answer:'',behavior:'',evidence:[],release:null},
  shipped:false, copy:'', copyType:'', issueResolved:false,pendingLaunch:null,launchSettlement:null,
  demoAttended:false, demoResult:'',
  activityIds:[], activitySpend:0, activitySeed:Math.floor(Math.random()*0xFFFFFFFF),
  activityResults:{}, activityLedger:[], postedActivityEntries:{}, learnedLessons:[], unlockedTests:[],
  storyFlags:[],
  // consequences ledger
  exposures:[], trustPenalty:0, fitAtShip:'closed', _blewOvernight:false,
  // day accounting
  dayStartCash:700, dayStartAiDaily:2.25, opRevenue:0, opAI:0, sponsorCash:0, preorderCash:0,
  coffeeSpend:0, purchaseSpend:0, fixedSpend:0,
  usersLost:0, refundPaid:0, settled:false, gameOver:false,
  previousCopy:'', previousCopyType:'', previousTaskId:'',
  day7Ignored:false, day7IgnoredUsers:0,
  marketCutsceneSeen:false,
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
const taskSet = () => day7() ? PUBLIC_DAY7_TASKS : PUBLIC_DAY8_TASKS;
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
const activityInflation = () => Math.max(0.01,Number(S.inflationMultiplier)||1);
const scaleActivityMoney = amount => Math.round(Number(amount||0)*activityInflation()*100)/100;
const activityCashCost = activity => scaleActivityMoney(activity.cost.cash);
const activityHours = activity => activity.durationMinutes/60;
const activityResult = id => S.activityResults?.[id]||null;
const activityLedgerEntries = () => S.activityLedger||[];

function activityHash(value){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function chooseActivityEvent(activity){
  const available=activity.eventTable.filter(row=>activityAssetsForEvent(activity,row).length);
  if(!available.length)return null;
  const rng=mulberry32((S.activitySeed^activityHash(`${S.day}:${activity.id}`))>>>0);
  const total=available.reduce((sum,row)=>sum+row.weight,0);
  let cursor=rng()*total;
  return available.find(row=>((cursor-=row.weight)<=0))||available[available.length-1];
}

function activityAssetAvailable(asset){
  if(!asset||asset.status!=='approved'||asset.composition?.faceSafe!==true)return false;
  if(asset.requiresFlag&&!S.storyFlags.includes(asset.requiresFlag))return false;
  if(asset.retireWhenFlag&&S.storyFlags.includes(asset.retireWhenFlag))return false;
  return true;
}

function activityAssetsForEvent(activity,event){
  const approved=(activity.presentation.assets||[]).filter(activityAssetAvailable);
  const required=event?.assetTags||[];
  return required.length?approved.filter(asset=>required.every(tag=>asset.tags.includes(tag))):approved;
}

function chooseActivityAsset(activity,event){
  const pool=activityAssetsForEvent(activity,event);
  if(!pool.length)return null;
  const rng=mulberry32((S.activitySeed^activityHash(`${S.day}:${activity.id}:art`))>>>0);
  return pool[Math.floor(rng()*pool.length)]||pool[0];
}

function chooseActivityBackground(activity,event){
  const asset=chooseActivityAsset(activity,event);
  if(asset)return asset.path;
  const pool=activity.presentation.backgrounds?.length?activity.presentation.backgrounds:[activity.presentation.background].filter(Boolean);
  return pool[0]||'';
}

function recordActivityEntry(activity,effectId,resource,amount,timing,label,detail='',metadata={}){
  const id=`day-${S.day}:activity:${activity.id}:${effectId}`;
  if(activityLedgerEntries().some(entry=>entry.id===id))return null;
  const entry=Object.freeze({
    id,day:S.day,source:Object.freeze({type:'activity',id:activity.id,name:activity.name}),
    resource,amount,timing,label,detail,inflationMultiplier:activityInflation(),
    eventId:metadata.eventId||'',eventTitle:metadata.eventTitle||'',script:Object.freeze([...(metadata.script||[])]),
    status:timing==='settlement'?'pending':'posted'
  });
  S.activityLedger.push(entry);
  if(timing==='immediate')S.postedActivityEntries[id]=true;
  return entry;
}

function applyActivityEffect(activity,effect,event,index){
  const eventId=event?.id||'';
  const suffix=eventId?`${eventId}:${effect.id||index}`:(effect.id||index);
  const amount=effect.monetary?scaleActivityMoney(effect.amount):Number(effect.amount||0);
  const entry=recordActivityEntry(activity,suffix,effect.type,amount,effect.timing,effect.label||activity.name,effect.value||'',{
    eventId,eventTitle:event?.title||'',script:event?.screens?.map(screen=>`${screen.speaker}: ${screen.text}`)||[]
  });
  if(!entry||effect.timing!=='immediate')return;
  if(effect.type==='energy')S.energy=Math.max(0,Math.min(5,S.energy+amount));
  if(effect.type==='cash')S.cash+=amount;
  if(effect.type==='users')S.users=Math.max(0,S.users+amount);
  if(effect.type==='lesson'&&!S.learnedLessons.includes(effect.value))S.learnedLessons.push(effect.value);
  if(effect.type==='test-unlock'&&!S.unlockedTests.includes(effect.value))S.unlockedTests.push(effect.value);
}

function postActivitySettlementEntries(){
  const posted=[];
  activityLedgerEntries().forEach(entry=>{
    if(entry.day!==S.day||entry.timing!=='settlement'||S.postedActivityEntries[entry.id])return;
    if(entry.resource==='cash')S.cash+=entry.amount;
    if(entry.resource==='users')S.users=Math.max(0,S.users+entry.amount);
    S.postedActivityEntries[entry.id]=true;
    posted.push(entry);
  });
  return posted;
}

function currentActivityEntries(){return activityLedgerEntries().filter(entry=>entry.day===S.day);}

function activitySettlementRows(entries){
  return entries.map(entry=>{
    if(entry.resource==='cash')return [`${entry.source.name} · ${entry.label}`,`${entry.amount>=0?'+':'−'}${plainMoney(Math.abs(entry.amount))}`];
    if(entry.resource==='users')return [`${entry.source.name} · ${entry.label}`,`${entry.amount>=0?'+':'−'}${Math.abs(entry.amount)} users`];
    return null;
  }).filter(Boolean);
}

function activityImpact(activity){
  const result=activityResult(activity.id),entries=currentActivityEntries().filter(entry=>entry.source.id===activity.id);
  const energy=entries.filter(entry=>entry.resource==='energy').reduce((sum,entry)=>sum+entry.amount,0);
  const notes=[];
  if(result?.eventText)notes.push(result.eventText);
  entries.filter(entry=>entry.resource==='lesson'||entry.resource==='test-unlock').forEach(entry=>{
    const note=entry.detail||entry.label;
    if(note&&!notes.some(existing=>existing.includes(note)||note.includes(existing)))notes.push(note);
  });
  if(energy)notes.push(`Energy ${energy>0?'+':''}${energy}.`);
  return `<div class="impact"><b>Outside activity · ${activity.name}</b>${notes.join(' ')||'Completed and recorded.'}</div>`;
}

function activityEffectLabel(effect){
  const amount=effect.monetary?`${effect.amount>=0?'+':'−'}$${Math.abs(effect.amount)}`:effect.amount!==undefined?`${effect.amount>=0?'+':''}${effect.amount} ${effect.type}`:effect.value||effect.type;
  return `${amount} · ${effect.timing}`;
}

function activityDefinitionTable(){
  return `<div class="activity-ledger-block"><h3>Response tables</h3><p class="table-note">One row is selected once per activity and day. Weight controls relative likelihood; monetary effects use the inflation snapshot captured when the activity starts.</p><div class="table-scroll"><table class="activity-ledger-table"><thead><tr><th>Activity</th><th>Response row</th><th>Weight</th><th>Ledger effects</th></tr></thead><tbody>${Object.values(ACTIVITIES).flatMap(activity=>activity.eventTable.map(row=>`<tr><td>${activity.name}</td><td><b>${row.title}</b><small>${row.screens.map(screen=>screen.text).join(' ')}</small></td><td>${row.weight}</td><td>${row.effects.length?row.effects.map(activityEffectLabel).join('<br>'):'Narrative only'}</td></tr>`)).join('')}</tbody></table></div></div>`;
}

function activityRunLedgerTable(){
  const entries=currentActivityEntries();
  return `<div class="activity-ledger-block"><h3>Today’s activity journal</h3><p class="table-note">Immediate entries have posted. Settlement entries remain pending until End Day and are idempotent.</p><div class="table-scroll"><table class="activity-ledger-table"><thead><tr><th>Source</th><th>Selected event / entry</th><th>Resource</th><th>Amount</th><th>Status</th></tr></thead><tbody>${entries.length?entries.map(entry=>`<tr><td>${entry.source.name}</td><td><b>${entry.eventTitle||entry.label}</b><small>${entry.script.join(' ')||entry.detail||entry.label}</small></td><td>${entry.resource}</td><td>${entry.resource==='cash'?money(entry.amount):entry.amount||'—'}</td><td><span class="ledger-status ${S.postedActivityEntries[entry.id]?'posted':'pending'}">${S.postedActivityEntries[entry.id]?'Posted':'Pending'}</span></td></tr>`).join(''):'<tr><td colspan="5">No outside activity has been recorded today.</td></tr>'}</tbody></table></div></div>`;
}

function advanceTime(hours){
  const actual = Math.max(0, Math.min(hours, 24 - S.time));
  const fraction = actual / OPERATING_HOURS;
  const rev = dailyRevenue() * fraction, ai = S.aiDaily * fraction;
  // Operations accrue while time passes, but Cash posts once at End Day.
  // This keeps the HUD calm and gives settlement one accounting authority.
  S.opRevenue += rev; S.opAI += ai; S.time += actual;
}

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}

/* ============================================================
   Scene system (visual-novel beats)
   ============================================================ */
function showScene(spec){
  // presentation layers render in this order: background, cast, dialogue.
  let page = 0;
  const renderPage = () => {
    const p = spec.pages[page];
    const last = page === spec.pages.length - 1;
    const presentation=spec.presentation||{};
    const background=presentation.background?` style="--activity-background:url('${presentation.background}')"`:'';
    const cast=(presentation.characters||[]).map(character=>`<img class="scene-character activity-character ${character.side==='right'?'right':''}" src="${character.asset}" alt="${character.alt||character.name||''}">`).join('');
    openModal(`<div class="scene ${spec.cls||''} ${presentation.background?'activity-background':''}"${background}>
      ${spec.art?`<img class="scene-character" src="${spec.art}" alt="${spec.artAlt||''}">`:''}
      ${cast}
      <div class="scene-box ${spec.art||cast?'':'wide'}">
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

function notifyModalState(open){
  try{window.top.postMessage({type:'vcs-modal-state',open},'*');}catch{}
}
function openModal(content, closable=true){$('overlay').hidden=false;$('modal').innerHTML=content;if(closable)$('modal').querySelectorAll('[data-close]').forEach(close=>close.onclick=closeModal);notifyModalState(true);}
function closeModal(){$('overlay').hidden=true;$('modal').innerHTML='';notifyModalState(false);render();}
window.VCSPrototype=Object.freeze({closeModal:()=>{if(!$('overlay').hidden)closeModal();},isModalOpen:()=>!$('overlay').hidden});
function resourceBar(){return `<div class="resource-bar" aria-label="Resources before this action"><span>Cash <b>${plainMoney(S.cash)}</b></span><span>AI credits <b>${Math.floor(S.credits)} ⚡</b></span><span>Energy <b>${S.energy}/5</b></span><span>Clock <b>${timeText()}</b></span></div>`;}

function loopPhase(){if(!S.morningDone)return'morning';if(!S.selectedTaskId)return'choose';if(!S.build)return'build';if(!allPassed())return'test';if(!S.shipped)return'ship';return'settle';}

function allPassed(){return !!task() && !!S.build && S.tested && S.testResults.length>0 && S.testResults.filter(r=>!r.skipped).every(r=>r.pass);}

function nextStationKey(){
  if(!S.morningDone||!S.selectedTaskId)return null;
  if(!S.build)return'oracle';
  if(S.build.kind==='oracle-v2'){
    if(['build','customer-pass','second-result','diagnosis','patch'].includes(S.oracleV2.stage))return'test';
    if(['revised','release'].includes(S.oracleV2.stage))return'oracle';
  }
  if(S.build.kind==='oracle-v2-day8'){
    if(!S.tested||S.oracleDay8.stage==='build')return'test';
    if(S.oracleDay8.stage==='result')return'oracle';
  }
  if(!S.tested||!allPassed())return'test';
  if(!S.shipped)return'door';
  return null;
}

function nextActionHint(){
  const next=nextStationKey();
  if(!S.morningDone)return'Read the overnight message to begin.';
  if(!S.selectedTaskId)return'Open today’s customer request.';
  if(next==='oracle')return S.build?'Next: ORACLE Studio — review the evidence and record the release.':'Next: ORACLE Studio — turn the customer request into a saved build.';
  if(next==='test')return`Next: Test Bench — Dev has ${day7()?'the customer photo':'Westside Clinic’s outage replay'} ready.`;
  if(next==='door')return'Next: Event / Release — choose how the tested build reaches people.';
  if(S.shipped)return'Release recorded. End the day when you are ready to settle the books.';
  return'Choose a station to continue.';
}

function render(){
  const net = dailyProductResult(), t = task();
  $('hud-day').textContent = `${String(S.day).padStart(2,'0')} · ${timeText()}`;
  $('hud-cash').textContent = plainMoney(S.cash);
  $('hud-cash-note').textContent = `midnight costs ${plainMoney(FIXED_BURN)}`;
  $('hud-margin').textContent = fmtDay(net);
  $('hud-margin-note').textContent = `user revenue minus daily AI cost`;
  $('hud-compute').textContent = `${Math.floor(S.credits)} ⚡`;
  $('hud-energy').textContent = `${S.energy} / 5`;
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
  $('game-subtitle').textContent = nextActionHint();
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
  oracle.querySelector('small').textContent = !S.selectedTaskId?'choose a task first':S.build?`build ${S.build.kind?.startsWith('oracle-v2')?S.productVersion:`v${S.version}`} saved · revise here`:'choose product behavior';
  test.classList.toggle('done',pass);
  test.querySelector('small').textContent = !S.build?'Dev needs a saved build':S.tested?(pass?'Dev: today’s test is finished':'Dev has a failure to review'):'Dev has the test queued';
  const activityCount=activities().length;
  outside.classList.toggle('done',activityCount>0);
  outside.querySelector('small').textContent = activityCount?`${activityCount} ${activityCount===1?'activity':'activities'} today · map still open`:'activities around the Valley';
  door.classList.toggle('locked',!S.build);
  door.classList.toggle('done',S.shipped);
  const deadline=eventDeadline(task());
  door.querySelector('small').textContent = !S.build?'build something first':S.shipped?'released today · end day to reconcile':S.demoAttended?'event done · release open':S.time+1>deadline?`${eventName(task())} closed · release open`:`${eventName(task())} closes ${clockText(deadline)}`;
  const recommended=nextStationKey();
  document.querySelectorAll('[data-station]').forEach(station=>{
    const isNext=station.dataset.station===recommended;
    station.classList.toggle('recommended',isNext);
    if(isNext)station.setAttribute('aria-current','step');
    else station.removeAttribute('aria-current');
  });
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
  if(S.shipped&&key==='oracle'){
    toast('This launch is recorded. Settle the day; revisions belong to the next build.');
    return;
  }
  startPlayerAnimation('interact',true);clearTimeout(S._interactionTimer);S._interactionTimer=setTimeout(()=>startPlayerAnimation('idle',true),900);
  if(key==='oracle')showOracle();
  if(key==='test')(['oracle-v2','oracle-v2-day8'].includes(S.build?.kind)||(!S.build&&((day7()&&task()?.id==='glare')||(!day7()&&task()?.id==='offline'))))?showOracleV2TestBench():showTest();
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
        <p>One day. One product priority. Build, test, revise, and release while the clock and resources last.</p>`,
        aside:'The money, briefly: 84 users generate $7.56/day. ClearRead costs $2.25/day in AI to run, leaving $5.31 before $105 in rent and tools. Cash lasts about 7.0 days if nothing changes.'}
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
  const focused=ids.length===1;
  openModal(`<div class="modal-head"><div><div class="micro">Product board · day ${S.day}</div><h2 id="modal-title">${focused?'Today’s customer request':'Which problem gets today?'}</h2><p>${focused?'This focused public slice follows one ClearRead request from customer report through build, test, release, and settlement.':'Choose one product priority. You may revise, rebuild, and retest while time and resources remain.'}</p></div></div>
  <div class="modal-body"><div class="task-grid ${focused?'single-task':''}">${ids.map((id,i)=>{const t=set[id];return `
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
    <div class="modal-actions"><button class="btn" id="defer-product-request">Not today — return to Garage HQ</button></div>
  </div>`, false);
  $('modal').querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>chooseTask(b.dataset.task));
  $('defer-product-request').onclick=()=>{closeModal();$('world-message').textContent='Today’s customer request is still open. Choose it later, use the rest of the day, or end the day.';toast('Request deferred · no product selected');};
}

function chooseTask(id){
  S.selectedTaskId=id;S.answers={};S.qIndex=0;S.selected=[];S.reviewedSlots=[];
  S.build=null;S.tested=false;S.testResults=[];S.shipped=false;S.issueResolved=false;S.pendingLaunch=null;S.launchSettlement=null;S.demoAttended=false;S.demoResult='';S.version=0;
  if(day7())S.productVersion='0.7.4';
  if(day7())S.oracleV2={stage:'dialogue',question:0,answers:{},behaviors:[],secondPhoto:null,diagnosis:'',patch:'',evidence:[],release:null};
  else S.oracleDay8={stage:'question',answer:'',behavior:'',evidence:[],release:null};
  closeModal();
  const t=task();
  toast(`${productScope(t)}: ${t.title}`);
  if(!S.inviteShown){S.inviteShown=true;showInviteScene();}
  else $('world-message').textContent=`${productScope(t)}. Today’s goal: ${t.title}. Next: go to ORACLE Studio and ${t.id==='offline'?'choose the offline behavior for the existing ClearRead build':t.id==='glare'?'make two product decisions':'answer four product questions'}.`;
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
      onDone:()=>{const t=task();$('world-message').textContent=`${productScope(t)}. Today’s goal: ${t.title}. Next: go to ORACLE Studio and ${t.id==='offline'?'choose the offline behavior for the existing ClearRead build':t.id==='glare'?'make two product decisions':'answer four product questions'}.`;}
  });
}

/* ============================================================
   ORACLE — Day 7 staged Q&A
   ============================================================ */
function showOracle(){
  if(day7()&&task()?.id==='glare'){showOracleV2();return;}
  if(!day7()&&task()?.id==='offline'){showOracleDay8V2();return;}
  day7() ? showOracleDay7() : showOracleDay8();
}

function oracleV2Shell({art=ASSET.oracle,artClass='',eyebrow,title,lede='',body='',choices='',footer=''}){
  openModal(`<section class="oracle-v2"><div class="oracle-v2-art ${artClass}"><img src="${art}" alt=""></div><article class="oracle-v2-copy">
    <div class="micro">${eyebrow}</div><h2 id="modal-title">${title}</h2>${lede?`<p>${lede}</p>`:''}${resourceBar()}${body}${choices?`<div class="oracle-v2-choices">${choices}</div>`:''}${footer?`<div class="oracle-v2-footer">${footer}</div>`:''}
  </article></section>`,false);
}

function showOracleV2(){
  const stage=S.oracleV2.stage||'dialogue';
  if(stage==='dialogue'||stage==='question')showOracleV2Question();
  else if(stage==='brief')showOracleV2Brief();
  else if(stage==='build')showOracleV2DevTestOffer();
  else if(stage==='customer-pass')showOracleV2DevChoice();
  else if(stage==='second-result')showOracleV2SecondResult();
  else if(stage==='diagnosis')showOracleV2Diagnosis();
  else if(stage==='patch')showOracleV2Patch();
  else if(stage==='revised')showOracleV2Revised();
  else if(stage==='release')showOracleV2Release();
  else showOracleV2Brief();
}

function showOracleV2Question(){
  const index=S.oracleV2.question||0,q=ORACLE_V2_QUESTIONS[index];
  if(!q){S.oracleV2.behaviors=oracleV2Lines();S.oracleV2.stage='brief';showOracleV2Brief();return;}
  const customer=index===0?`<div class="phone-msg"><span class="from">USER_0047</span><span class="when">LAST NIGHT</span><p>“The box says half. Grandma almost took two. Can ClearRead refuse when it cannot see the whole dose?”</p></div>`:'';
  oracleV2Shell({art:index===0?ASSET.user47:ASSET.oracle,eyebrow:`ORACLE STUDIO · DECISION ${index+1} OF 2`,title:q.title,
    lede:index===0?'ClearRead 0.7.4 is already live for 84 people. You are repairing the first app you built earlier this week.':'This decision records the recovery behavior and the evidence the build must preserve.',
    body:customer,
    choices:q.options.map(o=>`<button class="oracle-v2-choice" data-v2-answer="${o.id}"><strong>${o.label}</strong><span>${o.note}</span></button>`).join(''),
    footer:'<button class="btn" id="v2-back-garage">Back to Garage HQ</button>'});
  $('v2-back-garage').onclick=closeModal;
  $('modal').querySelectorAll('[data-v2-answer]').forEach(b=>b.onclick=()=>{
    const option=q.options.find(o=>o.id===b.dataset.v2Answer);
    Object.assign(S.oracleV2.answers,option.answers);S.oracleV2.question=index+1;S.oracleV2.stage='question';showOracleV2Question();
  });
}

function oracleV2BehaviorList(){return `<div class="oracle-v2-behaviors">${S.oracleV2.behaviors.map((line,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><span>${line}</span></div>`).join('')}</div>`;}

function showOracleV2Brief(){
  S.oracleV2.behaviors=oracleV2Lines();
  const cost=ORACLE_V2_COSTS.build,needsPack=S.credits<cost.credits+ORACLE_V2_COSTS.test.credits;
  const packText=needsPack?`Buy ${CREDIT_PACK} Credits for ${plainMoney(DAY7_PACK_PRICE)}, then use ${cost.credits} Credits for the build.`:`Use ${cost.credits} prepaid Credits for the build.`;
  oracleV2Shell({art:ASSET.oracleBuild,artClass:'build',eyebrow:'ORACLE · CLEARREAD 0.7.5 BUILD PLAN',title:'Your two decisions become four saved behaviors.',
    lede:'Review the exact product behavior before spending Cash, Credits, time, or Energy.',body:oracleV2BehaviorList()+`<div class="plain-rule"><b>Build receipt:</b> ${packText} ${cost.hours} hour · ${cost.energy} Energy. Direct purchases post immediately; operating revenue and AI cost accrue while the hour passes.</div>`,
    choices:`<button class="oracle-v2-choice primary" id="v2-build"><strong>${needsPack?`Buy Credits and build · ${plainMoney(DAY7_PACK_PRICE)}`:'Build ClearRead 0.7.5'}</strong><span>Cash ${plainMoney(S.cash)} → ${plainMoney(S.cash-(needsPack?DAY7_PACK_PRICE:0))} · Credits ${Math.floor(S.credits)} → ${Math.floor(S.credits+(needsPack?CREDIT_PACK:0)-cost.credits)} · Energy ${S.energy} → ${S.energy-cost.energy}</span></button>`,
    footer:'<button class="btn" id="v2-edit">Change the two decisions</button><button class="btn" id="v2-cancel">Back to Garage HQ</button>'});
  $('v2-edit').onclick=()=>{S.oracleV2.question=0;S.oracleV2.answers={};S.oracleV2.stage='question';showOracleV2Question();};
  $('v2-cancel').onclick=closeModal;
  $('v2-build').onclick=()=>saveOracleV2Build(needsPack);
}

function saveOracleV2Build(needsPack){
  const cost=ORACLE_V2_COSTS.build;if(S.build?.kind==='oracle-v2'||S.energy<cost.energy||S.time+cost.hours>24)return;
  if(needsPack){if(S.cash<DAY7_PACK_PRICE)return;S.cash-=DAY7_PACK_PRICE;S.credits+=CREDIT_PACK;S.purchaseSpend+=DAY7_PACK_PRICE;}
  if(S.credits<cost.credits)return;
  S.credits-=cost.credits;S.energy-=cost.energy;advanceTime(cost.hours);S.productVersion='0.7.5';S.version=5;
  S.build={kind:'oracle-v2',answers:{...S.oracleV2.answers},behaviors:[...S.oracleV2.behaviors],cost:cost.credits,instruction:S.oracleV2.behaviors.join(' '),defect:false};
  S.tested=false;S.testResults=[];S.oracleV2.stage='build';render();showOracleV2DevTestOffer();
}

function showOracleV2DevTestOffer(){
  oracleV2Shell({art:ASSET.dev,eyebrow:'DEV · BUILD 0.7.5 REVIEW',title:'“Let’s prove the repair against the photo that exposed it.”',
    lede:'Dev points back to USER_0047’s report before anyone relies on the new build.',
    body:'<div class="oracle-v2-dev"><b>Dev:</b> “The new rules are saved. USER_0047 already gave us the photograph that failed last night. We should replay that exact photo before we call this fixed.”</div>',
    choices:'<button class="oracle-v2-choice primary" id="v2-test-now"><strong>Test the reported photograph now</strong><span>Open the customer evidence · 30 minutes · 20 Credits</span></button><button class="oracle-v2-choice" id="v2-test-later"><strong>Save it for the Test Bench</strong><span>Return to Garage HQ. Dev will keep the same test ready there.</span></button>',
    footer:'<button class="btn" id="v2-build-back">Review the saved build</button>'});
  $('v2-test-now').onclick=showOracleV2CustomerTest;
  $('v2-test-later').onclick=()=>{closeModal();$('world-message').textContent='ClearRead 0.7.5 is saved. Dev is waiting at the Test Bench with USER_0047’s reported photograph.';toast('Test deferred · resume at the Test Bench');render();};
  $('v2-build-back').onclick=showOracleV2Brief;
}

function showOracleV2CustomerTest(){
  const cost=ORACLE_V2_COSTS.test;
  oracleV2Shell({art:ASSET.user47,eyebrow:'CUSTOMER EVIDENCE · REPORTED PHOTO',title:'Does 0.7.5 fix the failure USER_0047 reported?',
    lede:'Dev chose this test because it reproduces the exact glossy-label failure. If the build handles this photograph, the reported incident is fixed.',body:oracleV2BehaviorList(),
    choices:`<button class="oracle-v2-choice primary" id="v2-customer-test"><strong>Test USER_0047’s photo</strong><span>${cost.hours*60} minutes · ${cost.credits} Credits · no Energy</span></button>`,
    footer:'<button class="btn" id="v2-pause">Return to Garage HQ</button>'});
  $('v2-pause').onclick=closeModal;
  $('v2-customer-test').onclick=()=>{
    if(S.credits<cost.credits||S.time+cost.hours>24)return;S.credits-=cost.credits;advanceTime(cost.hours);S.tested=true;
    S.testResults=[{name:'Reported glossy dosage line',detail:'ClearRead refuses to speak an incomplete dosage and asks for a clearer photo.',slot:'customer',pass:true}];
    S.oracleV2.evidence=[{id:'customer',label:'Reported glossy dosage line',result:'pass'}];S.issueResolved=true;S.oracleV2.stage='customer-pass';render();showOracleV2DevChoice();
  };
}

function showOracleV2DevChoice(){
  oracleV2Shell({art:ASSET.dev,eyebrow:'CUSTOMER PHOTO · PASSED',title:'The reported failure is fixed.',
    lede:'ClearRead refuses the obscured dose and asks for a clearer photo. That proves the repair against the photograph USER_0047 sent.',
    body:`<div class="oracle-v2-result pass"><strong>✓ Reported glossy dosage line</strong><span>ClearRead did not guess.</span></div><div class="oracle-v2-dev"><b>Dev:</b> “One photo passes. Before we call the repair finished, I want to know whether the next clear photo starts clean—or inherits anything from the first.”</div>`,
    choices:`<button class="oracle-v2-choice primary" id="v2-second"><strong>Test a second clear photo</strong><span>30 minutes · 20 Credits · adds evidence about repeat scans</span></button><button class="oracle-v2-choice" id="v2-release-one"><strong>Release after one test</strong><span>The reported photo is proven; repeat scans remain visibly untested.</span></button>`});
  $('v2-second').onclick=runOracleV2SecondPhoto;
  $('v2-release-one').onclick=()=>{S.oracleV2.secondPhoto='untested';S.oracleV2.stage='release';showOracleV2Release();};
}

function runOracleV2SecondPhoto(){
  const cost=ORACLE_V2_COSTS.test;if(S.credits<cost.credits||S.time+cost.hours>24)return;
  S.credits-=cost.credits;advanceTime(cost.hours);const pass=oracleV2SecondPhotoPasses();S.oracleV2.secondPhoto=pass?'pass':'fail';
  S.testResults.push({name:'Second clear photo',detail:pass?'A fresh photo starts a fresh reading.':'The second photo is clear, but ClearRead repeats the first photo’s answer.',slot:'second',pass});
  S.oracleV2.evidence.push({id:'second',label:'Second clear photo',result:pass?'pass':'fail'});S.oracleV2.stage='second-result';render();showOracleV2SecondResult();
}

function showOracleV2SecondResult(){
  if(S.oracleV2.secondPhoto==='pass'){
    oracleV2Shell({art:ASSET.dev,eyebrow:'SECOND PHOTO · PASSED',title:'The next photo starts clean.',lede:'ClearRead reads the new evidence instead of reusing the previous scan.',body:'<div class="oracle-v2-result pass"><strong>✓ Second clear photo</strong><span>The repeat-scan behavior is now proven.</span></div>',choices:'<button class="oracle-v2-choice primary" id="v2-to-release"><strong>Record a release</strong><span>Choose how far this tested build can travel.</span></button>'});
    $('v2-to-release').onclick=()=>{S.oracleV2.stage='release';showOracleV2Release();};return;
  }
  oracleV2Shell({art:ASSET.dev,eyebrow:'SECOND PHOTO · FAILED',title:'ClearRead repeated the first photo’s answer.',
    lede:'The second photo was clear and contained a different dose. The camera succeeded; the saved build reused information from the previous scan.',
    body:'<div class="oracle-v2-result fail"><strong>× Second clear photo</strong><span>The new photo did not start a new reading.</span></div><div class="oracle-v2-dev"><b>Dev:</b> “The evidence changed, but the answer did not. Let’s identify what the build kept between scans.”</div>',
    choices:'<button class="oracle-v2-choice primary" id="v2-diagnose"><strong>Find the cause</strong><span>Use what the two photos actually showed.</span></button>'});
  $('v2-diagnose').onclick=()=>{S.oracleV2.stage='diagnosis';showOracleV2Diagnosis();};
}

function showOracleV2Diagnosis(message=''){
  oracleV2Shell({art:ASSET.dev,eyebrow:'DEV · SECOND-PHOTO REVIEW',title:'What caused the repeated answer?',
    lede:'The second photo was clear and different from the first. Choose the explanation that fits those facts.',
    body:`${message?`<div class="plain-rule" style="border-left-color:var(--yellow)">${message}</div>`:''}`,
    choices:'<button class="oracle-v2-choice" data-v2-diagnosis="memory"><strong>The first photo stayed in the scan</strong><span>The new photo never received a clean reading session.</span></button><button class="oracle-v2-choice" data-v2-diagnosis="camera"><strong>The second photo was blurry</strong><span>The camera may have hidden the dose.</span></button>',
    footer:'<button class="btn" id="v2-diagnosis-back">Back to the result</button>'});
  $('v2-diagnosis-back').onclick=showOracleV2SecondResult;
  $('modal').querySelectorAll('[data-v2-diagnosis]').forEach(b=>b.onclick=()=>{
    if(b.dataset.v2Diagnosis!=='memory'){showOracleV2Diagnosis('That would explain an unclear image. But the second photo was clear and produced the first photo’s exact answer.');return;}
    S.oracleV2.diagnosis='memory';S.oracleV2.stage='patch';showOracleV2Patch();
  });
}

function showOracleV2Patch(){
  const revise=ORACLE_V2_COSTS.revise,test=ORACLE_V2_COSTS.test;
  const cost={credits:revise.credits+test.credits,hours:revise.hours+test.hours,energy:revise.energy};
  oracleV2Shell({art:ASSET.oracle,eyebrow:'ORACLE · FOCUSED REVISION',title:'Make every new photo start clean.',
    lede:'Keep the four chosen behaviors. Add one implementation rule: clear the previous photo before a new reading begins.',
    body:oracleV2BehaviorList()+`<div class="oracle-v2-result"><strong>Added implementation rule</strong><span>Clear the previous photo before reading a new one.</span></div>`,
    choices:`<button class="oracle-v2-choice primary" id="v2-patch"><strong>Revise and rerun both photos</strong><span>${cost.hours*60} minutes · ${cost.credits} Credits · ${cost.energy} Energy</span></button>`,
    footer:'<button class="btn" id="v2-patch-back">Back to the diagnosis</button>'});
  $('v2-patch-back').onclick=showOracleV2Diagnosis;
  $('v2-patch').onclick=()=>{
    if(S.credits<cost.credits||S.energy<cost.energy||S.time+cost.hours>24)return;S.credits-=cost.credits;S.energy-=cost.energy;advanceTime(cost.hours);
    S.productVersion='0.7.6';S.version=6;S.oracleV2.patch='Clear the previous photo before reading a new one.';S.oracleV2.secondPhoto='pass';
    S.testResults=S.testResults.map(r=>({...r,pass:true,detail:r.slot==='second'?'ClearRead clears the previous photo before reading the next one.':r.detail}));
    S.oracleV2.evidence=S.oracleV2.evidence.map(e=>({...e,result:'pass'}));S.oracleV2.stage='revised';render();showOracleV2Revised();
  };
}

function showOracleV2Revised(){
  oracleV2Shell({art:ASSET.oracle,eyebrow:'CLEARREAD 0.7.6 · TESTED',title:'Both photographs now pass.',lede:'The reported glossy label is safe, and a second clear photo begins a new reading.',body:'<div class="oracle-v2-result pass"><strong>✓ Reported glossy dosage line</strong><span>ClearRead refuses to guess.</span></div><div class="oracle-v2-result pass"><strong>✓ Second clear photo</strong><span>The previous scan is cleared first.</span></div>',choices:'<button class="oracle-v2-choice primary" id="v2-revised-release"><strong>Record a release</strong><span>Choose the market scope supported by this evidence.</span></button>'});
  $('v2-revised-release').onclick=()=>{S.oracleV2.stage='release';showOracleV2Release();};
}

function showOracleV2Release(){
  const second=S.oracleV2.secondPhoto;
  const evidence=second==='pass'?'reported glossy label and repeat scans':'reported glossy label only';
  oracleV2Shell({art:ASSET.oracleBuild,artClass:'build',eyebrow:`RELEASE RECORD · CLEARREAD ${S.productVersion}`,title:'How far should this build travel?',
    lede:`Proven today: ${evidence}. Market response remains pending until settlement; this screen records scope, not an outcome.`,
    body:`<div class="scope-grid"><div class="scope-box"><h3>Proven</h3><ul>${S.oracleV2.evidence.filter(e=>e.result==='pass').map(e=>`<li>${e.label}</li>`).join('')}</ul></div><div class="scope-box risk"><h3>Not proven</h3><ul>${second==='untested'?'<li>Second-photo sessions</li>':''}<li>Other languages</li><li>New label formats</li><li>Untested lighting</li></ul></div></div><div class="plain-rule">Recording the release takes 30 minutes. It does not add users or revenue yet.</div>`,
    choices:'<button class="oracle-v2-choice" data-v2-scope="evidence"><strong>Release to the tested cases</strong><span>Keep the launch inside today’s evidence.</span></button><button class="oracle-v2-choice primary" data-v2-scope="wide"><strong>Release to the wider market</strong><span>Invite use in cases this build has not demonstrated.</span></button>',
    footer:'<button class="btn" id="v2-release-back">Back to the evidence</button>'});
  $('v2-release-back').onclick=()=>{S.oracleV2.stage=second==='pass'?(S.oracleV2.patch?'revised':'second-result'):'customer-pass';showOracleV2();};
  $('modal').querySelectorAll('[data-v2-scope]').forEach(b=>b.onclick=()=>recordOracleV2Release(b.dataset.v2Scope));
}

function recordOracleV2Release(scope){
  if(S.shipped)return;advanceTime(.5);S.shipped=true;S.copyType=scope;S.copy=scope==='evidence'?'ClearRead repair released to the tested cases.':'ClearRead repair opened to the wider market.';
  S.oracleV2.release={scope,version:S.productVersion,status:'market result pending',evidence:S.oracleV2.evidence.map(e=>({...e}))};
  S.pendingLaunch=null;S.fitAtShip='closed';S.issueResolved=true;closeModal();$('world-message').textContent=`ClearRead ${S.productVersion} release recorded. Market response stays pending until settlement. You can still use the remaining day or attend ${eventName(task())}.`;toast(`Release recorded · ${scope==='evidence'?'tested cases':'wider market'} · settlement pending`);render();
}

function showOracleV2TestBench(){
  if(!S.build){
    oracleV2Shell({art:ASSET.dev,eyebrow:`DEV · TEST BENCH · DAY ${S.day}`,title:'“Nothing is queued yet.”',
      lede:S.day===7?'Dev has USER_0047’s photograph ready, but ORACLE needs a saved build to test against it.':'Dev has the clinic outage replay ready, but ORACLE needs today’s ClearRead update first.',
      choices:'<button class="oracle-v2-choice primary" id="bench-to-oracle"><strong>Go to ORACLE Studio</strong><span>Define and save the build before testing.</span></button>',footer:'<button class="btn" id="bench-empty-back">Back to Garage HQ</button>'});
    $('bench-to-oracle').onclick=showOracle;$('bench-empty-back').onclick=closeModal;return;
  }
  if(!S.tested){
    if(day7())showOracleV2CustomerTest();
    else showOracleDay8Test();
    return;
  }
  if(day7()&&S.oracleV2.stage==='second-result'&&S.oracleV2.secondPhoto==='fail'){showOracleV2SecondResult();return;}
  if(day7()&&S.oracleV2.stage==='diagnosis'){showOracleV2Diagnosis();return;}
  if(day7()&&S.oracleV2.stage==='patch'){showOracleV2Patch();return;}
  const dayLine=day7()
    ? '“What’s up? We finished today’s test, didn’t we? The evidence is saved. Come back tomorrow.”'
    : '“Westside’s outage replay passed. ClearRead 0.8.0 is recorded. Come back tomorrow—preferably before their Wi-Fi drops again.”';
  oracleV2Shell({art:ASSET.dev,eyebrow:`DEV · TEST BENCH · DAY ${S.day}`,title:dayLine,
    lede:day7()?'The reported photograph has been tested. Any optional second-photo work remains available through the saved evidence flow.':'Today’s clinic replay is complete; revisiting the bench cannot charge the same test twice.',
    body:`<div class="oracle-v2-result pass"><strong>✓ ${day7()?'Reported glossy dosage line':'Westside Clinic outage replay'}</strong><span>${day7()?'The result is stored with ClearRead '+S.productVersion+'.':'The offline behavior is stored with ClearRead 0.8.0.'}</span></div>`,
    footer:`${day7()&&S.oracleV2.stage==='customer-pass'?'<button class="btn" id="bench-dev-second">Ask about one more check</button>':''}<button class="btn" id="bench-done-back">Back to Garage HQ</button>`});
  const second=$('bench-dev-second');if(second)second.onclick=showOracleV2DevChoice;
  $('bench-done-back').onclick=closeModal;
}

/* ============================================================
   ORACLE — Day 8 focused update using the same V2 grammar
   ============================================================ */
function showOracleDay8V2(){
  const stage=S.oracleDay8?.stage||'question';
  if(stage==='question')showOracleDay8QuestionV2();
  else if(stage==='brief')showOracleDay8BriefV2();
  else if(stage==='build')showOracleDay8DevTestOffer();
  else if(stage==='result')showOracleDay8Result();
  else showOracleDay8QuestionV2();
}

function showOracleDay8QuestionV2(){
  oracleV2Shell({art:ASSET.oracle,eyebrow:'ORACLE STUDIO · DAY 8 · FOCUSED UPDATE',title:'What should ClearRead do when the clinic loses Wi-Fi?',
    lede:`ClearRead ${S.oracleV2.release?.version||S.productVersion} and yesterday’s four behaviors are still live. Today’s request adds one offline rule; it does not replace the saved product.`,
    body:'<div class="phone-msg"><span class="from">WESTSIDE CLINIC</span><span class="when">08:42</span><p>“The Wi-Fi dropped during appointments. Fourteen patients lost label reading.”</p></div><div class="oracle-v2-dev"><b>Dev:</b> “I queued their outage replay at the Test Bench. Choose what ClearRead should do offline, build it, and we’ll cut the connection to check your exact rule.”</div>',
    choices:ORACLE_DAY8_OPTIONS.map(o=>`<button class="oracle-v2-choice" data-day8-v2="${o.id}"><strong>${o.label}</strong><span>${o.note}</span></button>`).join(''),
    footer:'<button class="btn" id="day8-v2-back">Back to Garage HQ</button>'});
  $('day8-v2-back').onclick=closeModal;
  $('modal').querySelectorAll('[data-day8-v2]').forEach(b=>b.onclick=()=>{
    const option=ORACLE_DAY8_OPTIONS.find(o=>o.id===b.dataset.day8V2);S.oracleDay8.answer=option.id;S.oracleDay8.behavior=option.line;S.oracleDay8.stage='brief';showOracleDay8BriefV2();
  });
}

function day8BehaviorList(){
  const carried=S.oracleV2.behaviors||[];
  return `<div class="oracle-v2-behaviors">${carried.map((line,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><span>${line}</span></div>`).join('')}<div class="new"><b>${String(carried.length+1).padStart(2,'0')}</b><span>${S.oracleDay8.behavior}</span></div></div>`;
}

function showOracleDay8BriefV2(){
  const build=ORACLE_DAY8_COSTS.build,test=ORACLE_DAY8_COSTS.test;
  oracleV2Shell({art:ASSET.oracleBuild,artClass:'build',eyebrow:'ORACLE · CLEARREAD 0.8.0 BUILD PLAN',title:'Keep yesterday’s build. Add one offline rule.',
    lede:'The 200-Credit update package covers the implementation and its clinic replay: 180 Credits to build, then 20 Credits to test.',
    body:day8BehaviorList()+`<div class="plain-rule"><b>Day 8 receipt:</b> Buy ${CREDIT_PACK} Credits for ${plainMoney(DAY8_PACK_PRICE)}. Build: ${build.credits} Credits · ${build.hours} hour · ${build.energy} Energy. Test: ${test.credits} Credits · ${test.hours*60} minutes. Cash and Credits post only after confirmation.</div>`,
    choices:`<button class="oracle-v2-choice primary" id="day8-v2-buy"><strong>Buy 200 Credits and build 0.8.0 · ${plainMoney(DAY8_PACK_PRICE)}</strong><span>Cash ${plainMoney(S.cash)} → ${plainMoney(S.cash-DAY8_PACK_PRICE)} · Credits ${Math.floor(S.credits)} → ${Math.floor(S.credits+CREDIT_PACK-build.credits)} after the build</span></button>`,
    footer:'<button class="btn" id="day8-v2-edit">Change the offline rule</button><button class="btn" id="day8-v2-cancel">Back to Garage HQ</button>'});
  $('day8-v2-edit').onclick=()=>{S.oracleDay8.stage='question';showOracleDay8QuestionV2();};$('day8-v2-cancel').onclick=closeModal;
  $('day8-v2-buy').onclick=showOracleDay8PurchaseConfirm;
}

function showOracleDay8PurchaseConfirm(){
  const beforeCash=S.cash,beforeCredits=S.credits,cost=ORACLE_DAY8_COSTS.build;
  const shortfall=Math.max(0,DAY8_PACK_PRICE-beforeCash),canAfford=!shortfall;
  oracleV2Shell({art:ASSET.oracleBuild,artClass:'build',eyebrow:'CONFIRM · DAY 8 CREDIT PURCHASE',title:'Spend $180 on the update package?',
    lede:'Nothing is spent until you confirm. Cancelling returns to the build plan without changing Cash, Credits, Energy, or time.',
    body:`<div class="oracle-v2-result"><strong>Cash</strong><span>${plainMoney(beforeCash)} → ${plainMoney(beforeCash-DAY8_PACK_PRICE)}</span></div><div class="oracle-v2-result"><strong>Prepaid AI Credits after the build</strong><span>${Math.floor(beforeCredits)} + ${CREDIT_PACK} − ${cost.credits} = ${Math.floor(beforeCredits+CREDIT_PACK-cost.credits)} Credits</span></div>${canAfford?'':`<div class="inline-notice">You are ${plainMoney(shortfall)} short. Earn or preserve more Cash before buying this update.</div>`}`,
    choices:`<button class="oracle-v2-choice primary" id="day8-v2-confirm" ${canAfford?'':'disabled'}><strong>Buy Credits and build the update</strong><span>${cost.hours} hour · ${cost.energy} Energy · clinic test remains ready at the Test Bench</span></button>`,
    footer:'<button class="btn" id="day8-v2-confirm-cancel">Cancel</button>'});
  $('day8-v2-confirm-cancel').onclick=showOracleDay8BriefV2;
  $('day8-v2-confirm').onclick=saveOracleDay8Build;
}

function saveOracleDay8Build(){
  const cost=ORACLE_DAY8_COSTS.build;
  if(S.build?.kind==='oracle-v2-day8')return;
  if(S.cash<DAY8_PACK_PRICE){toast(`Not enough Cash · need ${plainMoney(DAY8_PACK_PRICE)}, have ${plainMoney(S.cash)}`);return;}
  if(S.energy<cost.energy){toast(`Not enough Energy · need ${cost.energy}`);return;}
  if(S.time+cost.hours>24){toast('Not enough time remains today.');return;}
  S.cash-=DAY8_PACK_PRICE;S.credits+=CREDIT_PACK;S.purchaseSpend+=DAY8_PACK_PRICE;
  if(S.credits<cost.credits)return;S.credits-=cost.credits;S.energy-=cost.energy;advanceTime(cost.hours);S.productVersion='0.8.0';S.version=8;
  S.build={kind:'oracle-v2-day8',behaviors:[...S.oracleV2.behaviors,S.oracleDay8.behavior],cost:cost.credits,instruction:S.oracleDay8.behavior,defect:false};
  S.tested=false;S.testResults=[];S.oracleDay8.stage='build';render();showOracleDay8DevTestOffer();
}

function showOracleDay8DevTestOffer(){
  oracleV2Shell({art:ASSET.dev,eyebrow:'DEV · DAY 8 BUILD REVIEW',title:'“Westside sent us an outage replay.”',
    lede:'Dev has a clinic session ready to verify the new offline rule without rerunning yesterday’s unrelated evidence.',
    body:`<div class="oracle-v2-dev"><b>Dev:</b> “The update is built. Let’s cut the connection and see whether ClearRead actually does what you chose.”</div>`,
    choices:'<button class="oracle-v2-choice primary" id="day8-test-now"><strong>Run the clinic outage replay now</strong><span>30 minutes · 20 Credits · completes the 200-Credit update package</span></button><button class="oracle-v2-choice" id="day8-test-later"><strong>Save it for the Test Bench</strong><span>Return to Garage HQ. Dev will keep the outage replay queued.</span></button>',
    footer:'<button class="btn" id="day8-build-plan-back">Review the build plan</button>'});
  $('day8-test-now').onclick=showOracleDay8Test;$('day8-test-later').onclick=()=>{closeModal();$('world-message').textContent='ClearRead 0.8.0 is built. Dev is waiting at the Test Bench with Westside Clinic’s outage replay.';toast('Clinic test deferred · resume at the Test Bench');render();};$('day8-build-plan-back').onclick=showOracleDay8BriefV2;
}

function showOracleDay8Test(){
  const cost=ORACLE_DAY8_COSTS.test;
  oracleV2Shell({art:ASSET.dev,eyebrow:'TEST BENCH · WESTSIDE CLINIC',title:'Does 0.8.0 behave correctly when the connection disappears?',
    lede:`The replay cuts the clinic’s Wi-Fi during a label reading. The expected result is the offline rule you chose: ${S.oracleDay8.behavior}`,
    choices:`<button class="oracle-v2-choice primary" id="day8-run-test"><strong>Run the outage replay</strong><span>${cost.hours*60} minutes · ${cost.credits} Credits · no Energy</span></button>`,footer:'<button class="btn" id="day8-test-back">Back to Garage HQ</button>'});
  $('day8-test-back').onclick=closeModal;$('day8-run-test').onclick=runOracleDay8Test;
}

function runOracleDay8Test(){
  const cost=ORACLE_DAY8_COSTS.test;if(S.tested||S.credits<cost.credits||S.time+cost.hours>24)return;
  S.credits-=cost.credits;advanceTime(cost.hours);S.tested=true;S.issueResolved=true;S.testResults=[{name:'Westside Clinic outage replay',detail:S.oracleDay8.behavior,slot:'offline',pass:true}];
  S.oracleDay8.evidence=[{id:'offline',label:'Westside Clinic outage replay',result:'pass'}];S.oracleDay8.stage='result';render();showOracleDay8Result();
}

function showOracleDay8Result(){
  oracleV2Shell({art:ASSET.oracle,eyebrow:'CLEARREAD 0.8.0 · CLINIC REPLAY PASSED',title:'The saved offline rule works.',
    lede:'Yesterday’s four ClearRead behaviors remain intact. Today’s outage replay adds one recorded piece of evidence.',
    body:day8BehaviorList()+`<div class="oracle-v2-result pass"><strong>✓ Westside Clinic outage replay</strong><span>${S.oracleDay8.behavior}</span></div>`,
    choices:'<button class="oracle-v2-choice primary" id="day8-record-release"><strong>Record the 0.8.0 update</strong><span>Carry yesterday’s release scope forward; market response remains pending until settlement.</span></button>',footer:'<button class="btn" id="day8-result-back">Back to Garage HQ</button>'});
  $('day8-result-back').onclick=closeModal;$('day8-record-release').onclick=recordOracleDay8Release;
}

function recordOracleDay8Release(){
  if(S.shipped||S.time+.5>24)return;advanceTime(.5);S.shipped=true;
  const scope=S.oracleV2.release?.scope||'evidence';S.copyType=scope;S.copy='ClearRead 0.8.0 update recorded with the tested offline behavior.';
  S.oracleDay8.release={scope,version:'0.8.0',status:'market result pending',evidence:S.oracleDay8.evidence.map(e=>({...e}))};
  if(!S.oracleV2.behaviors.includes(S.oracleDay8.behavior))S.oracleV2.behaviors.push(S.oracleDay8.behavior);
  if(S.oracleV2.release){S.oracleV2.release.version='0.8.0';S.oracleV2.release.evidence=[...S.oracleV2.release.evidence,...S.oracleDay8.evidence.map(e=>({...e}))];}
  closeModal();$('world-message').textContent='ClearRead 0.8.0 is recorded. The saved product and evidence will reconcile at End Day; market response remains pending.';toast('0.8.0 update recorded · settlement pending');render();
}

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
  const quick = {credits:90, hours:1, energy:1};
  const careful = {credits:180, hours:1.5, energy:1};
  const quickRepeat=repeatBuildBlocked('quick'),carefulRepeat=repeatBuildBlocked('careful');
  const revision = S.build ? `This replaces build v${S.version} — a fresh build, paid again.` : '';
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE · ${t.app} · ${t.title}</div><h2 id="modal-title">Your instruction is ready</h2><p>Change any answer, then choose how the build is made. ${revision}</p>${resourceBar()}</div></div>
  <div class="modal-body">
    <div class="instruction-panel"><span class="slot-label">IMPLEMENTATION BRIEF</span>${instructionSoFar()}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${QUESTIONS.map((q,i)=>`<button class="btn ghost" data-redo="${q.slot}" style="font-size:11px">Change answer ${i+1}</button>`).join('')}</div>
    <div class="build-choice">
      <div class="build-card">
        <h3>Quick build</h3>
        <div class="price">${quick.credits} prepaid ⚡ · ${quick.hours}h · ${quick.energy} Energy</div>
        <p>“The cheap way. Plainly: a quick build is <b>more likely to leave a coding bug</b> — even in behaviors you chose correctly. We’ll only know when we test.”</p>
        <p style="font-size:12px;color:var(--muted)">If a bug slips through: finding it costs a test run (30 ⚡ · 1h · 1 Energy), and fixing it costs another generated build. A late bug can cost you the ${clockText(eventDeadline(t))} customer event.</p>
        <button class="btn cyan" id="build-quick" ${quickRepeat||S.credits<quick.credits||S.energy<quick.energy||S.time+quick.hours>24?'disabled':''}>${quickRepeat?'Already saved — test this build':'Buy the quick build'}</button>
      </div>
      <div class="build-card careful">
        <h3>Careful build</h3>
        <div class="price">${careful.credits} prepaid ⚡ · ${careful.hours}h · ${careful.energy} Energy</div>
        <p>“Twice the price. I take my time and check my own work — a coding bug is very unlikely.”</p>
        <p style="font-size:12px;color:var(--muted)">Buys code quality only. It cannot add a behavior that the brief never requested.</p>
        <button class="btn primary" id="build-careful" ${carefulRepeat||S.credits<careful.credits||S.energy<careful.energy||S.time+careful.hours>24?'disabled':''}>${carefulRepeat?'Already saved — test this build':'Buy the careful build'}</button>
      </div>
    </div>
    <div class="plain-rule">The brief is the product strategy. Tests check whether the build performs each chosen behavior; the incident replay separately shows whether this strategy solves today’s case.</div>
    ${S.energy<1?'<div class="plain-rule" style="border-left-color:var(--yellow)">Not enough Energy to build — coffee at the bar restores 2 for $18.</div>':''}
    <div class="modal-actions">${S.credits<quick.credits?`<button class="btn" id="day7-buy-credits" ${S.cash<DAY7_PACK_PRICE?'disabled':''}>Buy ${CREDIT_PACK} ⚡ · ${plainMoney(DAY7_PACK_PRICE)}</button>`:''}<button class="btn" data-close>Back to the garage</button></div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-redo]').forEach(b=>b.onclick=()=>{delete S.answers[b.dataset.redo];showQuestion();});
  const q=$('build-quick'), c=$('build-careful');
  if(q&&!q.disabled)q.onclick=()=>generateDay7('quick',quick);
  if(c&&!c.disabled)c.onclick=()=>generateDay7('careful',careful);
  const buy=$('day7-buy-credits');if(buy&&!buy.disabled)buy.onclick=()=>confirmCreditPurchase(showBuildChoice);
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
  if(repeatBuildBlocked(kind)||S.credits<cost.credits||S.energy<cost.energy||S.time+cost.hours>24)return;
  const before={credits:S.credits,energy:S.energy,cash:S.cash,time:timeText()};
  S.credits-=cost.credits;S.energy-=cost.energy;advanceTime(cost.hours);
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
  toast(`Build v${S.version}: ${before.credits}→${S.credits} ⚡ · Energy ${before.energy}→${S.energy} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);
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
  const standard={credits:120,hours:1,energy:1},reviewed={credits:240,hours:1.5,energy:1};
  const same=(kind)=>S.build?.kind===kind&&JSON.stringify(S.build.chips||[])===JSON.stringify(S.selected||[])&&(!S.tested||!S.build.defect);
  const standardRepeat=same('standard'),reviewedRepeat=same('reviewed');
  openModal(`<div class="modal-head"><div><div class="micro">ORACLE STUDIO · ${t.app} · ${t.title}</div><h2 id="modal-title">Choose how ORACLE implements the brief</h2><p>The same four product questions lead to the same two build choices. A reviewed build costs more because ORACLE checks the generated code before handing it back.</p>${resourceBar()}</div><button class="close" data-close aria-label="Close">×</button></div>
  <div class="modal-body">
    <div class="task-reminder"><div><b>${t.person}</b><span>${t.problem}</span></div><strong>${eventName(t)} · ${clockText(eventDeadline(t))}</strong></div>
    <div class="coverage">${requiredChips().map(c=>`<button class="${S.selected.includes(c.id)?'covered':''}" data-review="${c.slot}"><b>${questionFor(t,c.slot)}</b><span>${S.selected.includes(c.id)?displayFeature(c.text):'Left unanswered'} · change</span></button>`).join('')}</div>
    <div class="prompt-readback"><span class="slot-label">GENERATED BUILD BRIEF</span>${promptSentence()}</div>
    <div class="build-choice">
      <div class="build-card"><h3>Standard build</h3>
        <div class="price">${standard.credits} prepaid ⚡ · ${standard.hours}h · ${standard.energy} Energy</div>
        <p>ORACLE generates the code once. Your four requirements remain exactly as written; the Test Bench reveals whether the implementation needs another pass.</p>
        <button class="btn cyan" id="build-standard" ${standardRepeat||coverageCount()<1||S.credits<standard.credits||S.energy<standard.energy||S.time+standard.hours>24?'disabled':''}>${standardRepeat?'Already saved — test this build':'Buy the Standard build'}</button>
      </div>
      <div class="build-card careful"><h3>Reviewed build</h3>
        <div class="price">${reviewed.credits} prepaid ⚡ · ${reviewed.hours}h · ${reviewed.energy} Energy</div>
        <p>ORACLE generates the same brief, then checks the implementation before returning it. This buys code review; it cannot invent a requirement you left out.</p>
        <button class="btn primary" id="build-reviewed" ${reviewedRepeat||coverageCount()<1||S.credits<reviewed.credits||S.energy<reviewed.energy||S.time+reviewed.hours>24?'disabled':''}>${reviewedRepeat?'Already saved — test this build':'Buy the Reviewed build'}</button>
      </div>
    </div>
    <div class="plain-rule">Omitted requirements fail because they were never requested. An implementation defect is different: you requested the behavior, but the generated code needs another pass. The Test Bench names which one happened.</div>
    <div class="modal-actions">
      ${S.credits<standard.credits?`<button class="btn" id="buy-credits" ${S.cash<DAY8_PACK_PRICE?'disabled':''}>Buy ${CREDIT_PACK} ⚡ · cash ${plainMoney(S.cash)} → ${plainMoney(S.cash-DAY8_PACK_PRICE)}</button>`:''}
      <button class="btn" data-close>Back</button>
    </div>
  </div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{S.reviewedSlots=S.reviewedSlots.filter(x=>x!==b.dataset.review);showOracleDay8();});
  const buy=$('buy-credits');if(buy&&!buy.disabled)buy.onclick=()=>confirmCreditPurchase(showDay8BuildChoice);
  const standardButton=$('build-standard'),reviewedButton=$('build-reviewed');
  if(standardButton&&!standardButton.disabled)standardButton.onclick=()=>generateDay8('standard',standard);
  if(reviewedButton&&!reviewedButton.disabled)reviewedButton.onclick=()=>generateDay8('reviewed',reviewed);
}

function confirmCreditPurchase(returnTo=showDay8BuildChoice){
  const price=day7()?DAY7_PACK_PRICE:DAY8_PACK_PRICE;
  const beforeCash=S.cash,beforeCredits=S.credits;
  openModal(`<div class="modal-head"><div><div class="micro">AI credit purchase</div><h2 id="modal-title">Move ${plainMoney(price)} from Cash into prepaid Credits?</h2><p>This is an immediate purchase, not a midnight estimate.</p></div></div>
    <div class="modal-body"><table class="settle-table"><tr><td>Cash</td><td>${plainMoney(beforeCash)} → ${plainMoney(beforeCash-price)}</td></tr><tr><td>AI Credits</td><td>${Math.floor(beforeCredits)} ⚡ → ${Math.floor(beforeCredits+CREDIT_PACK)} ⚡</td></tr></table>
    <div class="modal-actions"><button class="btn" id="credit-cancel">Cancel</button><button class="btn primary" id="credit-confirm">Buy ${CREDIT_PACK} ⚡</button></div></div>`,false);
  $('credit-cancel').onclick=returnTo;
  $('credit-confirm').onclick=()=>{if(S.cash<price)return;S.cash-=price;S.credits+=CREDIT_PACK;S.purchaseSpend+=price;toast(`AI Credits purchased · cash ${plainMoney(beforeCash)} → ${plainMoney(S.cash)}`);returnTo();render();};
}

function generateDay8(kind,cost){
  if(cost.credits>S.credits||S.energy<cost.energy||S.time+cost.hours>24)return;
  const before={credits:S.credits,energy:S.energy,cash:S.cash};
  S.credits-=cost.credits;S.energy-=cost.energy;advanceTime(cost.hours);
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
  toast(`Build v${S.version}: ${before.credits}→${S.credits} ⚡ · Energy ${before.energy}→${S.energy} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);
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
  if(S.unlockedTests.includes('changing-light-photo')){
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
    openModal(`<div class="modal-head"><div><div class="micro">Test bench · ${task().app} · build v${S.version}</div><h2 id="modal-title">Replay the incident</h2><p>${task().person}’s case, re-run against the saved build · ${cost} prepaid ⚡ · 1 Energy · 1 hour.</p>${resourceBar()}</div><button class="close" data-close>×</button></div>
    <div class="modal-body">
      <div class="test-list">${rows.map(x=>`<div class="test-row"><span class="icon">○</span><div><b>${x.name}</b><small>${x.detail}</small></div><strong>NOT RUN</strong></div>`).join('')}</div>
      <div class="plain-rule">Two different ways to miss here: a product behavior absent from the build brief, or an implementation defect in a behavior you selected. The results identify which one happened and route you to the right fix.</div>
      ${S.energy<1?'<div class="plain-rule" style="border-left-color:var(--yellow)">Not enough Energy to test — coffee at the bar restores 2 for $18.</div>':''}
      <div class="modal-actions"><button class="btn" data-close>Back</button><button class="btn primary" id="run-tests" ${S.credits<cost||S.energy<1||S.time+1>24?'disabled':''}>Run the tests · ${cost} ⚡ · 1 Energy · 1h</button></div>
    </div>`);
    $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
    const run=$('run-tests');if(run&&!run.disabled)run.onclick=()=>{const before={credits:S.credits,energy:S.energy,cash:S.cash};S.credits-=30;S.energy-=1;advanceTime(1);S.tested=true;S.testResults=runTestRows();toast(`Test run: ${before.credits}→${S.credits} ⚡ · Energy ${before.energy}→${S.energy} · cash ${plainMoney(before.cash)}→${plainMoney(S.cash)}`);showTestResults();render();};
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

function activitySceneText(text){
  return String(text).replace(/\$(\d+(?:\.\d+)?)/g,(_,amount)=>plainMoney(scaleActivityMoney(Number(amount))));
}

function activityCostBadges(activity){
  const cash=activityCashCost(activity),energy=activity.cost.energy;
  const gains=[...new Set(activity.eventTable.map(row=>row.effects.filter(effect=>effect.type==='energy'&&effect.amount>0).reduce((sum,effect)=>sum+effect.amount,0)))];
  const gain=gains.length===1?gains[0]:0;
  return `<span class="activity-cost ${cash?'cash-cost':'cash-free'}">${cash?`−${plainMoney(cash)}`:'Free'}</span>${energy?`<span class="activity-cost energy-cost">⚡ −${energy} Energy</span>`:''}${gain?`<span class="activity-cost energy-gain">⚡ +${gain} Energy</span>`:''}`;
}

function showActivities(){
  const t=task(),done=activities();
  openModal(`<div class="modal-head"><div><div class="micro">Garage exit · outside map</div><h2 id="modal-title">Where do you go next?</h2><p>Take as many different activities as the day, your cash, and the schedule allow. Each location is available once per day.</p></div><button class="close" data-close>×</button></div>
    <div class="modal-body"><div class="task-grid">${Object.values(ACTIVITIES).map(a=>{
      const used=didActivity(a.id),allowed=activityAvailable(a,t),cashCost=activityCashCost(a),hours=activityHours(a);
      return `<article class="task-card"><div class="inner"><div class="app-type">${a.location} · ${hours}h</div><div class="activity-title"><h3>${a.name}</h3><div class="activity-costs">${activityCostBadges(a)}</div></div><p>${a.preview.description}</p>
        ${allowed?'':`<p>This activity is not available for today’s selected product.</p>`}
        <button class="btn cyan" data-activity="${a.id}" ${used||!allowed||S.cash<cashCost||S.energy<a.cost.energy||S.time+hours>24?'disabled':''}>${used?'Done today':`Go · ${hours}h${cashCost?` · −${plainMoney(cashCost)}`:''}${a.cost.energy?` · −${a.cost.energy} Energy`:''}`}</button></div></article>`;
    }).join('')}</div>${done.length?`<div class="plain-rule"><b>Today so far:</b> ${done.map(a=>a.name).join(' · ')}. You can choose another distinct activity or return to the garage.</div>`:''}</div>`);
  $('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('modal').querySelectorAll('[data-activity]').forEach(b=>b.onclick=()=>chooseActivity(b.dataset.activity));
}

function chooseActivity(id){
  const a=ACTIVITIES[id],t=task();
  if(!a)return;
  const cashCost=activityCashCost(a),hours=activityHours(a);
  if(didActivity(id)||!activityAvailable(a,t)||S.cash<cashCost||S.energy<a.cost.energy||S.time+hours>24)return;
  const event=chooseActivityEvent(a);
  if(!event){toast('No approved scene is available for this activity yet.');return;}
  const before={cash:S.cash,energy:S.energy};
  S.cash-=cashCost;S.activitySpend+=cashCost;
  recordActivityEntry(a,'direct-cost','cash',-cashCost,'immediate',`${a.name} direct cost`);
  if(a.cost.energy){S.energy-=a.cost.energy;recordActivityEntry(a,'energy-cost','energy',-a.cost.energy,'immediate',`${a.name} Energy`);}
  advanceTime(hours);S.activityIds.push(id);
  recordActivityEntry(a,`event:${event.id}`,'event',0,'immediate',event.title,event.screens.map(screen=>screen.text).join(' '),{eventId:event.id,eventTitle:event.title,script:event.screens.map(screen=>`${screen.speaker}: ${screen.text}`)});
  event.effects.forEach((effect,index)=>applyActivityEffect(a,effect,event,index));
  const selectedAsset=chooseActivityAsset(a,event),background=selectedAsset?.path||chooseActivityBackground(a,event);
  S.activityResults[id]=Object.freeze({activityId:id,eventId:event.id,eventTitle:event.title,eventText:activitySceneText(event.screens.map(screen=>screen.text).join(' ')),assetId:selectedAsset?.id||'',assetEmotion:selectedAsset?.emotion||'',background,inflationMultiplier:activityInflation()});
  closeModal();
  $('world-message').textContent=`Outside activity complete: ${a.name}.`;
  toast(`${a.name} · cash ${plainMoney(before.cash)} → ${plainMoney(S.cash)} · Energy ${before.energy} → ${S.energy}`);
  const pages=[...a.scriptScreens.map((screen,index)=>({speaker:screen.speaker,title:index===0?a.name:'',html:`<p>${activitySceneText(screen.text)}</p>`})),...event.screens.map((screen,index)=>({speaker:screen.speaker,title:index===0?event.title:'',html:`<p>${activitySceneText(screen.text)}</p>`}))];
  showScene({cls:a.presentation.sceneClass,presentation:{...a.presentation,background},pages,doneLabel:'Return to Garage HQ',onDone:render});
  render();
}

/* ============================================================
   Take a break — rest or coffee
   ============================================================ */
function useCoffee(){
  if(S.energy>=5){toast('Energy is already full.');return;}
  const coffeeCost=scaleActivityMoney(18),canRest=S.time+2<=24,canCoffee=S.time+0.5<=24&&S.cash>=coffeeCost;
  openModal(`<div class="modal-head"><div><div class="micro">Take a break</div><h2 id="modal-title">Have a rest, get some coffee!</h2><p>Choose between spending two hours or spending money. Either restores 2 Energy.</p></div><button class="close" data-close>×</button></div><div class="modal-body"><div class="break-grid"><button class="oracle-v2-choice" id="take-rest" ${canRest?'':'disabled'}><strong>Rest · free</strong><span>2 hours · +2 Energy</span></button><button class="oracle-v2-choice primary" id="buy-coffee" ${canCoffee?'':'disabled'}><strong>Get coffee · ${plainMoney(coffeeCost)}</strong><span>30 minutes · +2 Energy${activityInflation()!==1?` · price × ${activityInflation().toFixed(1)}`:''}</span></button></div>${!canCoffee&&S.cash<coffeeCost?`<div class="inline-notice">You need ${plainMoney(coffeeCost)} for coffee and have ${plainMoney(S.cash)}. Rest is still free.</div>`:''}<div class="modal-actions"><button class="btn" data-close>Cancel</button></div></div>`);
  $('take-rest').onclick=()=>{if(!canRest)return;S.energy=Math.min(5,S.energy+2);advanceTime(2);closeModal();toast(`Rested · +2 Energy · clock ${timeText()}`);render();};
  $('buy-coffee').onclick=()=>{if(!canCoffee)return;const before=S.cash;S.cash-=coffeeCost;S.coffeeSpend+=coffeeCost;S.energy=Math.min(5,S.energy+2);advanceTime(0.5);closeModal();toast(`Coffee: cash ${plainMoney(before)} → ${plainMoney(S.cash)} · +2 Energy`);render();};
}

/* ============================================================
   Timed customer event → release
   ============================================================ */
function showDoor(){
  if(S.shipped){
    if(!S.demoAttended&&eventOpen(task())&&allPassed()){showReleasedEventOpportunity();return;}
    showAlreadyReleased();return;
  }
  if(!S.build){toast('Build something first.');return;}
  if(S.build.kind==='oracle-v2-day8'&&allPassed()){showOracleDay8Result();return;}
  if(S.build.kind==='oracle-v2'&&allPassed()){S.oracleV2.stage='release';showOracleV2Release();return;}
  const t=task(),deadline=eventDeadline(t),open=eventOpen(t),name=eventName(t);
  const pass=allPassed();
  if(!pass){
    const failCount=S.tested?S.testResults.filter(r=>!r.pass).length:null;
    openModal(`<div class="modal-head"><div><div class="micro">${name} · ${open?`open until ${clockText(deadline)}`:'closed'}</div><h2 id="modal-title">${S.tested?'This build has known failures':'This build is untested'}</h2><p>${open?'You can still show unfinished work for feedback, but the customer only pays for a working result.':'This customer opportunity has closed. Release remains available until midnight, but only a fully passing build can ship.'}</p></div><button class="close" data-close>×</button></div>
    <div class="modal-body">
      ${S.tested?`<div class="plain-rule">${failCount} failing check${failCount===1?'':'s'} — the results screen says why each one failed.</div>`:'<div class="plain-rule">Run the tests first if you want the payment — the customer checks the result.</div>'}
      <div class="modal-actions"><button class="btn" id="to-test">To the Test Bench</button>${open&&!S.demoAttended?`<button class="btn cyan" id="rough-demo">Show unfinished work · 1h</button>`:''}<button class="btn" data-close>Back</button></div>
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

function showReleasedEventOpportunity(){
  const t=task();
  openModal(`<div class="modal-head"><div><div class="micro">${eventName(t)} · closes ${clockText(eventDeadline(t))}</div><h2 id="modal-title">The release is recorded. The customer event is still open.</h2><p>Show the tested build for one hour. If the customer accepts it, ${plainMoney(t.sponsor)} is recorded for settlement. Your market release scope does not change.</p></div><button class="close" data-close>×</button></div><div class="modal-body"><div class="modal-actions"><button class="btn" id="released-later">Not now</button><button class="btn primary" id="released-demo">Attend the event · 1h</button></div></div>`);
  $('released-later').onclick=showAlreadyReleased;$('released-demo').onclick=()=>presentDemo(true);
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
    const payment=task().sponsor;
    S.sponsorCash=payment;
    S.demoResult=`Working build shown — ${plainMoney(payment)} pending at midnight.`;
    showScene({cls:'stage',pages:[{speaker:eventName(task()).toUpperCase()+' · '+timeText(),title:'The customer accepts the result',html:`
      <p>${task().person}’s case works in front of them. The <b>${plainMoney(payment)}</b> payment is recorded and will post on the midnight receipt.</p><p>Operating cash while presenting: ${plainMoney(cashBefore)} → ${plainMoney(S.cash)}.</p>
      <p>An accepted demo is not a public release. Nothing has been promised to the market yet.</p>`}],
      doneLabel:S.shipped?'Return to Garage HQ':'Decide the release',onDone:S.shipped?()=>render():showRelease});
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
    <div class="plain-rule"><b>No market outcome posts yet.</b> Recording the launch takes 30 minutes. New users, event payments and deployed daily AI cost are reconciled on the midnight receipt.</div>
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
  const specBase=provenSegmentUsers(S.build.answers);
  S.pendingLaunch={type,baseUsers:type==='honest'?specBase:t.hype.users,aiDelta:type==='honest'?t.honest.ai:t.hype.ai,
    preorder:type==='hype'?t.hype.cash:0,exposure:type==='hype'?t.hype.exposure:0,
    odds:Math.min(0.85,(t.hypeOdds||0.5)+(fr&&fr.lvl!=='closed'?0.15:0))};
  closeModal();
  $('world-message').textContent=`Release recorded at ${timeText()}: “${S.copy}”. Cash, users, prior effects, and the deployed daily AI cost post together at midnight.`;
  toast(`${type==='honest'?'Evidence-matched':'Expansion'} launch recorded`);
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

function showMarketCutscene(){
  S.marketCutsceneSeen=true;
  openModal(`<section class="market-v2" style="--summit:url('${ASSET.summit}')">
    <div class="market-v2-art"><img class="market-v2-character alaric" src="${ASSET.alaric}" alt="Alaric Kade speaking"><img class="market-v2-character dorian" src="${ASSET.dorian}" alt="Dorian listening"></div>
    <article class="market-v2-copy"><div class="micro">LATE NIGHT · COMPUTE & CONSEQUENCE</div><h2 id="modal-title">Tomorrow may not cost what today did.</h2>
      <div class="market-v2-speech"><b>ALARIC</b><p>“Well, oh boy. What do you say about that compute, eh?”</p></div>
      <div class="market-v2-speech"><b>DORIAN</b><p>“You know how it is. Credits up 50%. Inference too. The more users you have, the more it hurts.”</p></div>
      <div class="market-v2-speech"><b>ALARIC</b><p>“Ha! I pity us. Same apps tomorrow—entirely different bills.”</p></div>
      <div class="oracle-v2-choices"><button class="oracle-v2-choice primary" id="market-close-day"><strong>Close Day 7</strong><span>Settle today’s books before the new prices take effect.</span></button><button class="oracle-v2-choice" id="market-return"><strong>Return to Garage HQ</strong><span>Keep the day open a little longer.</span></button></div>
    </article></section>`,false);
  $('market-close-day').onclick=settleDay;$('market-return').onclick=closeModal;
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
  $('confirm-settle').onclick=()=>day7()&&!S.marketCutsceneSeen?showMarketCutscene():settleDay();
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
  const activityPostings=postActivitySettlementEntries();
  S.cash+=S.opRevenue-S.opAI;
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
    ...activitySettlementRows(activityPostings),
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
    ${activities().map(activityImpact).join('')}
    ${S.demoAttended?`<div class="impact"><b>${eventName(t)}</b>${S.demoResult}</div>`:''}
    <div class="brief-grid">
      <div class="brief-card"><div class="k">Tomorrow’s users</div><strong>${S.users}</strong><p>${S.usersLost?`${S.usersLost} left over the skipped problem.`:S.issueResolved?'The chosen problem is fixed for them.':'No losses tonight.'}</p></div>
      <div class="brief-card"><div class="k">Tomorrow’s product result</div><strong>${fmtDay(dailyProductResult())}</strong><p>${fmtDay(dailyRevenue())} from users − ${plainMoney(S.aiDaily)}/day in AI.</p></div>
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
  S.day=8;S.time=9;S.energy=4;
  S.aiDaily*=DAY8_MULTIPLIER;
  if(refund){S.users=Math.max(0,S.users-4);S.trustPenalty=0.4;S.exposures.forEach(e=>{if(e.blown)e.amount-=Math.round(e.amount*REFUND_SHARE);});}
  // reset day state
  S.selectedTaskId='';S.answers={};S.qIndex=0;S.selected=[];S.reviewedSlots=[];S.inviteShown=false;
  S.oracleDay8={stage:'question',answer:'',behavior:'',evidence:[],release:null};
  S.build=null;S.tested=false;S.testResults=[];S.version=0;S.shipped=false;S.issueResolved=false;S.pendingLaunch=null;S.launchSettlement=null;
  S.demoAttended=false;S.demoResult='';S.activityIds=[];S.activitySpend=0;S.activityResults={};
  S.morningDone=false;S.settled=false;delete S._settlementRows;delete S._settlementChange;delete S._settlementBroke;
  S.dayStartCash=S.cash;S.dayStartAiDaily=S.aiDaily;S.opRevenue=0;S.opAI=0;S.sponsorCash=0;S.preorderCash=0;S.coffeeSpend=0;S.purchaseSpend=0;S.fixedSpend=0;S.usersLost=0;
  S.pos={x:50,y:70};S.facing='front';$('player').style.left=`${S.pos.x}%`;$('player').style.top=`${S.pos.y}%`;applyFacing();
  $('world-message').textContent='Day 8 begins. Read the overnight market update before choosing today’s work.';
  // charge the refund AFTER dayStartCash so it reconciles as a Day-8 line item
  S._morningRefund=refund;
  if(refund){S.cash-=refund;S.refundPaid=refund;}
  render();
  showDay8Morning();
}

function showDay8Morning(){
  const pages=[];
  // page 1: the price rise (always)
  const before=(S.aiDaily/DAY8_MULTIPLIER),after=S.aiDaily;
  pages.push({speaker:'07:12 · EMAIL',title:'ORACLE Corp raised its prices',html:`
    <div class="phone-msg"><span class="from">ORACLE CORP BILLING</span><span class="when">07:12</span>
    <p>Effective immediately, inference pricing at your tier rises. Thank you for building with ORACLE.</p></div>
    <div class="receipt bill"><b>What that does to you</b>
      <div class="r-row"><span>Daily AI operating cost</span><strong>${plainMoney(before)} → ${plainMoney(after)}</strong></div>
      <div class="r-row"><span>Unit-price multiplier</span><strong>1.0× → ${DAY8_MULTIPLIER.toFixed(1)}×</strong></div>
      <div class="r-row"><span>Next ${CREDIT_PACK}-Credit pack</span><strong>${plainMoney(DAY7_PACK_PRICE)} → ${plainMoney(DAY8_PACK_PRICE)}</strong></div>
    </div>`,
    aside:'The higher daily AI cost appears in the HUD and the midnight receipt.'});
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
  const tabs=[['products','Product'],['builds','Builds'],['promises','Promises'],['activities','Activities'],['people','People']];
  let rows=[];const t=task();
  if(S.recordTab==='products')rows=[
    ['Active product',`ClearRead · ${S.users} users generate ${fmtDay(dailyRevenue())} · daily AI cost ${plainMoney(S.aiDaily)} · product result ${fmtDay(dailyProductResult())}.`],
    ['Today’s task',t?`${t.title} — ${t.person}. ${S.issueResolved?'Resolved in the released scope.':S.build?'Build in progress.':'Not started.'}`:'None chosen yet.'],
    ['AI Credits',`${Math.floor(S.credits)} ⚡ prepaid. The current ${CREDIT_PACK}-Credit pack costs ${plainMoney(day7()?DAY7_PACK_PRICE:DAY8_PACK_PRICE)}.${S.purchaseSpend?` Today’s purchases moved ${plainMoney(S.purchaseSpend)} out of Cash.`:''}`]
  ];
  if(S.recordTab==='builds')rows=S.build?.kind==='oracle-v2'?[
    ['Saved build',`ClearRead ${S.productVersion} · initial generation pass ${S.build.cost} ⚡.`],
    ['Today’s ORACLE spend',`${ORACLE_V2_COSTS.build.credits+S.oracleV2.evidence.length*ORACLE_V2_COSTS.test.credits+(S.oracleV2.patch?ORACLE_V2_COSTS.revise.credits+ORACLE_V2_COSTS.test.credits:0)} ⚡ across generation, recorded tests, revision, and retest.`],
    ['Exact behaviors',S.build.behaviors.join(' · ')],
    ['Evidence',S.oracleV2.evidence.length?S.oracleV2.evidence.map(e=>`${e.label}: ${e.result}`).join(' · '):'No tests recorded.'],
    ['Focused revision',S.oracleV2.patch||'None.'],
    ['Release record',S.oracleV2.release?`${S.oracleV2.release.scope==='evidence'?'Tested cases':'Wider market'} · ${S.oracleV2.release.status}.`:'Not released.']
  ]:S.oracleV2.release?[
    ['Carried build',`ClearRead ${S.oracleV2.release.version} remains live from Day 7.`],
    ['Exact behaviors',S.oracleV2.behaviors.join(' · ')],
    ['Evidence',S.oracleV2.release.evidence.map(e=>`${e.label}: ${e.result}`).join(' · ')],
    ['Focused revision',S.oracleV2.patch||'None.'],
    ['Release record',`${S.oracleV2.release.scope==='evidence'?'Tested cases':'Wider market'} · ${S.oracleV2.release.status}.`]
  ]:S.build?[
    ['Saved build',`v${S.version} · ${displayFeature(S.build.kind)} build · ${S.build.cost} ⚡.`],
    ['Instruction',`“${S.build.instruction}”`],
    ['Code check',S.tested?(S.build.defect?'defect found':'clean'):'not tested yet'],
    ['Tests',S.tested?`${S.testResults.filter(r=>r.pass).length}/${S.testResults.length} passed`:'not run']
  ]:[['Saved build','None today.']];
  if(S.recordTab==='promises')rows=[
    [eventName(t),S.demoAttended?S.demoResult:S.time+1>eventDeadline(t)?`Closed at ${clockText(eventDeadline(t))} without a working presentation.`:`Open until ${clockText(eventDeadline(t))}.`],
    ['Public promise',S.copy?`“${S.copy}”`:'Nothing promised today.'],
    ['Pending at midnight',S.oracleV2.release&&!S.settled?`${S.oracleV2.release.scope==='evidence'?'Tested-case':'Wider-market'} release recorded. The market result is pending; no users or payments have posted.`:S.pendingLaunch&&!S.settled?`${S.pendingLaunch.type==='honest'?'Evidence-matched':'Expansion'} position recorded. Users, ${S.pendingLaunch.preorder?'preorders, ':''}trust, carried effects, and daily AI cost have not posted yet.`:'Nothing pending.'],
    ['On the books',expTotal()?S.exposures.filter(e=>e.amount>0).map(e=>`${plainMoney(e.amount)} owed against “${e.copy}”`).join('; ')+` — ${S.day===7?'part comes due next morning, the rest at the week wrap.':'due at the week wrap.'}`:'Nothing owed.'],
    ['Yesterday',S.previousCopy?`“${S.previousCopy}” (${S.previousCopyType==='hype'?'expansion segment — support case resolved this morning':'proven segment'}).`:'—']
  ];
  if(S.recordTab==='people')rows=[
    ['Founder (you)','Chooses the problem, writes the instruction, decides the promise.'],
    ['Life outside the garage',activities().length?activities().map(a=>{const result=activityResult(a.id);return `${a.name} at ${a.location}${result?.eventTitle?`: ${result.eventTitle}`:''}`;}).join(' · '):'No outside activities yet today. The map remains available while time and cash allow.'],
    ['USER_0047','The person the company exists for. His grandma hit the glare failure the night before Day 7.']
  ];
  const activityTables=S.recordTab==='activities'?activityDefinitionTable()+activityRunLedgerTable():'';
  openModal(`<div class="modal-head"><div><div class="micro">Company record</div><h2 id="modal-title">Product, builds, promises, activities, people</h2></div><button class="close" data-close>×</button></div>
  <div class="modal-body"><div class="record-tabs">${tabs.map(x=>`<button class="record-tab ${S.recordTab===x[0]?'active':''}" data-record-tab="${x[0]}">${x[1]}</button>`).join('')}</div>
  ${activityTables||rows.map(r=>`<div class="record-row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
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
  <div class="plain-rule">AI Credits (⚡) are separate: a prepaid balance for builds and tests. They only touch Cash at the moment you buy more (${CREDIT_PACK} ⚡ = ${plainMoney(day7()?DAY7_PACK_PRICE:DAY8_PACK_PRICE)} today).</div>
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
window.__vcsActivities={
  addActivity,
  compileScript:compileActivityScript,
  authoringIssues:activityAuthoringIssues,
  definitions:()=>JSON.parse(JSON.stringify(Object.values(ACTIVITIES)))
};
init();
