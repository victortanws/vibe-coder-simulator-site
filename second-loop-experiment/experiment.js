'use strict';

(function () {
  const ROOT = '..';
  const STORAGE_KEY = 'vcs_second_loop_state_v4';
  const SCHEMA_VERSION = 4;
  const ASSETS = Object.freeze({
    night: `${ROOT}/ChatGPT/UI-UX/backgrounds/BG-12/bg-12-dark-night-garage-v1.png`,
    garage: `${ROOT}/ChatGPT/R-assets/pixel-drafts/tilesets/Garage/garage-tileset-tier-2-v1.png`,
    user: `${ROOT}/ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png`,
    oracle: `${ROOT}/ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png`,
    founder: `${ROOT}/ChatGPT/R-assets/founder/PC-01a/pc-01a-v2.png`,
    buildScene: `${ROOT}/assets/scenes/founder-vibe-coding/pc-01-vibe-code-first-app-success-v1.png`,
    dev: `${ROOT}/ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png`,
    devExpressions: `${ROOT}/ChatGPT/R-assets/cast/CAST-04/cast-04-dev-expression-grid-v1.png`,
    founderSprite: `${ROOT}/assets/generated/sprites/PC-01/frames/idle/front-01.png`
  });

  const ECONOMY = Object.freeze({
    openingCash: 700, users: 84, credits: 80, focus: 4,
    revenuePerUserDay: .09, baselineUsers: 84,
    aiDailyAtBaselineUsage: 2.25, fixedDaily: 105,
    day8Multiplier: 1.5,
    creditPack: 200, day7PackPrice: 120, day8PackPrice: 180
  });
  const COSTS = Object.freeze({
    build: { minutes: 60, credits: 80, focus: 1 },
    test: { minutes: 30, credits: 20, focus: 0 },
    revise: { minutes: 45, credits: 36, focus: 1 },
    day8Update: { minutes: 90, credits: 200, focus: 1 }
  });

  const DAY8_OPTIONS = Object.freeze([
    { id: 'local', label: 'Run a small model on the phone', note: 'Keep core label reading available offline.', line: 'When the connection drops, read supported labels with the on-device model.' },
    { id: 'decline', label: 'Explain that ClearRead is offline', note: 'Do not attempt a reading without the network.', line: 'When the connection drops, explain that reading is unavailable.' },
    { id: 'defer', label: 'Leave the request open today', note: 'Spend nothing now; the clinic keeps waiting.', line: null }
  ]);

  const QUESTIONS = Object.freeze([
    { id: 'reading', title: 'What should ClearRead say aloud?', options: [
      { id: 'exact', label: 'Only a complete dosage', note: 'If glare hides any part, say it cannot read it.', answers: { purpose: 'exact', condition: 'glare' }, lines: ['Read the exact dosage only when the full line is visible.', 'When glare hides any part of the dosage, say it cannot be read.'] },
      { id: 'fragments', label: 'Only text it can confirm', note: 'Read visible fragments; never fill in hidden text.', answers: { purpose: 'fragments', condition: 'unreadable' }, lines: ['Read only text that is fully visible.', 'When critical text is hidden, never fill in the missing words.'] },
      { id: 'decline', label: 'Nothing unless the whole label is clear', note: 'Explain what prevented the reading.', answers: { purpose: 'decline', condition: 'medical' }, lines: ['Read a medicine label only when every critical field is clear.', 'When the label is uncertain, explain why no dosage will be spoken.'] }
    ]},
    { id: 'uncertainty', title: 'What should happen when it is unsure?', options: [
      { id: 'retake', label: 'Ask for a new photo', note: 'Read only after the new photo shows the full dosage.', answers: { proof: 'retake', fallback: 'silent' }, lines: ['A new photo must produce a new reading.', 'Until the dosage is clear, stay silent rather than guess.'] },
      { id: 'fresh', label: 'Start a fresh scan', note: 'Discard the old photo before trying again.', answers: { proof: 'retake', fallback: 'fresh' }, lines: ['A new photo must start a completely new scan.', 'When the dosage remains unclear, request another fresh photo.'] },
      { id: 'review', label: 'Offer a person to check it', note: 'Share the photo only after the user agrees.', answers: { proof: 'review', fallback: 'review' }, lines: ['A person must confirm the dosage before ClearRead speaks.', 'Offer human review only after the user agrees to share the photo.'] }
    ]}
  ]);

  const FIXTURES = Object.freeze({
    stale: {
      id: 'stale', title: 'Second photo', observed: 'The clear second photo produced the first photo\'s answer.',
      cause: 'The second photo was clear, but its answer came from the first scan.', correctDiagnosis: 'memory',
      diagnoses: [
        { id: 'memory', label: 'ClearRead kept the first photo', note: 'The second photo did not start a new reading.' },
        { id: 'camera', label: 'The second photo was blurry', note: 'The camera may still have hidden the dose.' }
      ],
      unsupported: 'That would explain an unclear photo. But this photo was clear, and ClearRead repeated the old answer.',
      patches: [
        { id: 'clear', label: 'Start every photo fresh', note: 'Forget the previous photo before reading the next one.', line: 'Clear the previous photo before reading a new one.' },
        { id: 'decline', label: 'Stop when two photos get mixed', note: 'Ask the user to begin again.', line: 'If two photos become mixed, stop and request a new scan.' }
      ]
    },
    handwriting: {
      id: 'handwriting', title: 'Readable handwriting', observed: 'The broad gate rejected a readable note.',
      cause: 'Printed labels and handwriting entered one evidence gate.', correctDiagnosis: 'branch',
      diagnoses: [
        { id: 'branch', label: 'No handwriting branch', note: 'Different evidence entered one condition.' },
        { id: 'network', label: 'The network was slow', note: 'The request may have timed out.' }
      ],
      unsupported: 'The request finished. A slow connection did not cause the rejection.',
      patches: [
        { id: 'separate', label: 'Separate handwriting', note: 'Check readable handwriting independently.', line: 'Use a separate evidence check for handwriting.' },
        { id: 'print', label: 'Name the supported input', note: 'Limit this release to printed labels.', line: 'Apply this build to printed labels only.' }
      ]
    },
    consent: {
      id: 'consent', title: 'After-hours review', observed: 'The photo entered a review queue automatically.',
      cause: 'Human review had no consent boundary.', correctDiagnosis: 'permission',
      diagnoses: [
        { id: 'permission', label: 'Permission was missing', note: 'The user never chose to share the image.' },
        { id: 'hours', label: 'The reviewer was offline', note: 'The queue may have been closed.' }
      ],
      unsupported: 'Availability does not explain why the image was shared automatically.',
      patches: [
        { id: 'ask', label: 'Ask before review', note: 'Make sharing an explicit choice.', line: 'Request consent before human review.' },
        { id: 'local', label: 'Keep the photo local', note: 'Decline instead of sharing automatically.', line: 'Decline locally unless the user requests review.' }
      ]
    },
    fragments: {
      id: 'fragments', title: 'Split dosage line', observed: 'Confirmed fragments formed an incomplete dose.',
      cause: 'Each fragment was certain; their combination was not.', correctDiagnosis: 'assembly',
      diagnoses: [
        { id: 'assembly', label: 'Fragments were combined', note: 'Certainty did not survive composition.' },
        { id: 'volume', label: 'Speech was too quiet', note: 'The user may not have heard the unit.' }
      ],
      unsupported: 'Volume cannot restore a unit that the assembled result omitted.',
      patches: [
        { id: 'complete', label: 'Require a complete field', note: 'Keep number and unit together.', line: 'Read a dosage only when its full field is confirmed.' },
        { id: 'visual', label: 'Keep fragments visual', note: 'Do not speak a partial dose.', line: 'Display fragments, but do not speak a partial dosage.' }
      ]
    },
    context: {
      id: 'context', title: 'Non-medical poster', observed: 'Medicine safeguards activated outside ClearRead.',
      cause: 'The product context was not preserved.', correctDiagnosis: 'mode',
      diagnoses: [
        { id: 'mode', label: 'Mode leaked outward', note: 'The rule needs a product boundary.' },
        { id: 'contrast', label: 'The poster lacked contrast', note: 'The image may have been difficult.' }
      ],
      unsupported: 'Contrast does not explain why a ClearRead-only safeguard ran elsewhere.',
      patches: [
        { id: 'bind', label: 'Bind the product mode', note: 'Run the rule only inside ClearRead.', line: 'Apply the rule only inside ClearRead medicine mode.' },
        { id: 'explicit', label: 'Require explicit mode', note: 'Ask before entering medicine mode.', line: 'Require an explicit medicine-label mode.' }
      ]
    },
    clean: {
      id: 'clean', title: 'Low-light dosage', observed: 'The chosen fallback handled the uncertain text.',
      cause: 'The saved brief already defines this boundary.', correctDiagnosis: null,
      diagnoses: [], patches: []
    }
  });

  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const money = value => `$${Number(value).toFixed(2)}`;
  const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const selectedOption = (question, answers) => question.options.find(item => Object.entries(item.answers).every(([key, value]) => answers[key] === value));
  const chosenLines = answers => QUESTIONS.flatMap(question => selectedOption(question, answers)?.lines || []);

  function deriveAdjacent(answers) {
    if (answers.proof === 'retake' && answers.fallback !== 'fresh') return FIXTURES.stale;
    if (answers.condition === 'unreadable' && answers.purpose !== 'decline') return FIXTURES.handwriting;
    if (answers.proof === 'review' && answers.fallback !== 'review') return FIXTURES.consent;
    if (answers.purpose === 'fragments' && answers.fallback !== 'silent') return FIXTURES.fragments;
    if (answers.condition === 'medical' && answers.fallback === 'fresh') return FIXTURES.context;
    return FIXTURES.clean;
  }

  function inferenceCost(users = ECONOMY.users, multiplier = 1) {
    return roundMoney(ECONOMY.aiDailyAtBaselineUsage * (users / ECONOMY.baselineUsers) * multiplier);
  }

  function approvedSettlement(opening = ECONOMY.openingCash, users = ECONOMY.users, multiplier = 1, directSpend = 0) {
    const revenue = roundMoney(users * ECONOMY.revenuePerUserDay);
    const aiCost = inferenceCost(users, multiplier);
    return {
      opening, directSpend, revenue, aiCost, fixed: ECONOMY.fixedDaily,
      closing: roundMoney(opening - directSpend + revenue - aiCost - ECONOMY.fixedDaily),
      users, day8AI: inferenceCost(users, ECONOMY.day8Multiplier)
    };
  }

  function futureScenarioPool(scope, fixtureTitle) {
    return scope === 'wide'
      ? ['other languages', 'new label formats', 'untested lighting']
      : ['glossy medicine labels', fixtureTitle || 'tested adjacent condition'];
  }

  function freshState() {
    return {
      schema: SCHEMA_VERSION, view: 'dialogue', oracleStage: null, question: 0,
      day: 7, minutes: 540, cash: ECONOMY.openingCash, users: ECONOMY.users,
      credits: ECONOMY.credits, focus: ECONOMY.focus, answers: {}, taps: 0,
      fixtureId: null, fixturePass: null, unsupportedDiagnosis: null,
      diagnosis: null, patch: null, settledDays: {}, settlements: [], purchases: [],
      dayOpeningCash: ECONOMY.openingCash, day8Answer: null, day8Update: null, day8Deferred: false,
      product: {
        name: 'ClearRead', createdByPlayer: false, version: null, behaviors: [], implementationBoundary: null,
        evidence: [], release: null, futureScenarios: []
      },
      events: []
    };
  }

  function applyPatch(state, patchId) {
    const fixture = FIXTURES[state.fixtureId];
    const patch = fixture?.patches.find(item => item.id === patchId);
    if (!patch || state.diagnosis !== fixture.correctDiagnosis) return false;
    state.patch = patch.id;
    state.product.version = '0.1.1';
    state.product.implementationBoundary = patch.line;
    state.product.evidence = [
      { id: 'glossy', label: 'Glossy dosage line', result: 'pass' },
      { id: fixture.id, label: fixture.title, result: 'pass' }
    ];
    state.fixturePass = true;
    return true;
  }

  function creditPackPrice(day) {
    return day === 8 ? ECONOMY.day8PackPrice : ECONOMY.day7PackPrice;
  }

  function buyCredits(state) {
    const price = creditPackPrice(state.day);
    if (state.cash < price) return false;
    state.cash = roundMoney(state.cash - price);
    state.credits += ECONOMY.creditPack;
    state.purchases.push({ day: state.day, credits: ECONOMY.creditPack, cash: price });
    return true;
  }

  function saveInitialBuild(state) {
    state.product.version = '0.1.0';
    state.product.createdByPlayer = true;
    state.product.behaviors = chosenLines(state.answers);
    return state.product;
  }

  function settlementForState(state) {
    const directSpend = state.purchases.filter(item => item.day === state.day).reduce((sum, item) => sum + item.cash, 0);
    const multiplier = state.day === 8 ? ECONOMY.day8Multiplier : 1;
    return approvedSettlement(state.dayOpeningCash, state.users, multiplier, directSpend);
  }

  function settleState(state) {
    if (state.settledDays[state.day]) return state;
    const ledger = settlementForState(state);
    state.cash = ledger.closing;
    state.users = ledger.users;
    state.minutes = 1440;
    state.settledDays[state.day] = true;
    state.settlements.push({ day: state.day, ...ledger });
    return state;
  }

  let state = freshState();
  let toastTimer = null;
  const $ = id => document.getElementById(id);

  function log(type, detail = '') {
    state.events.push({ type, detail, day: state.day, time: clock(state.minutes), tap: state.taps });
  }
  function save() {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    if (typeof localStorage === 'undefined') return freshState();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed?.schema === SCHEMA_VERSION && parsed.product ? parsed : freshState();
    } catch (_) { return freshState(); }
  }
  function commit() { save(); render(); }
  function spend(cost) { state.minutes += cost.minutes; state.credits -= cost.credits; state.focus -= cost.focus; }

  function renderHud() {
    $('hud').innerHTML = `<span class="day">DAY ${state.day}</span><b>${clock(state.minutes)}</b><span class="cash">${money(state.cash)}</span><span class="credits">${state.credits}⚡</span><span class="focus">${state.focus}/5 Focus</span>`;
    const phaseIndex = state.view === 'oracle' || state.view === 'dialogue' || state.view === 'day8Dialogue' ? 0 : state.view === 'settlement' ? 2 : 1;
    $('phase').innerHTML = ['Product work', 'Garage HQ', 'End Day'].map((label, index) => `<span title="${label}" class="${index < phaseIndex ? 'done' : index === phaseIndex ? 'active' : ''}"></span>`).join('');
  }

  function action(actionId, label, note, className = '', disabled = false) {
    return `<button type="button" class="action ${className}" data-action="${actionId}"${disabled ? ' disabled' : ''}><strong>${escapeHTML(label)}</strong><small>${escapeHTML(note)}</small></button>`;
  }
  function choice(actionId, label, note, value = '', primary = false) {
    return `<button type="button" class="choice${primary ? ' primary' : ''}" data-action="${actionId}"${value ? ` data-value="${escapeHTML(value)}"` : ''}><strong>${escapeHTML(label)}</strong><small>${escapeHTML(note)}</small></button>`;
  }
  function behaviorList(includeBoundary = false) {
    const lines = state.product.behaviors.length ? state.product.behaviors : chosenLines(state.answers);
    const items = lines.map(line => `<li>${escapeHTML(line)}</li>`);
    if (includeBoundary && state.product.implementationBoundary) items.push(`<li class="added">${escapeHTML(state.product.implementationBoundary)}</li>`);
    return `<div class="brief"><div class="brief-head"><span>SAVED BEHAVIOR</span><b>${state.product.version || 'DRAFT'}</b></div><ol class="behavior">${items.join('')}</ol></div>`;
  }
  function result(pass, title, observed) {
    return `<div class="result${pass ? '' : ' fail'}"><span>${pass ? '✓' : '×'}</span><div><strong>${escapeHTML(title)}</strong><small>${escapeHTML(observed)}</small></div></div>`;
  }

  function worldProductCard() {
    const release = state.product.release;
    if (!state.product.version) {
      return `<aside class="world-card product-card"><p class="eyebrow">YOUR FIRST APP</p><h2>ClearRead · not built yet</h2><div class="product-status"><div class="status-row"><span>Problem from</span><b>USER_0047</b></div><div class="status-row"><span>Build</span><b>Empty project</b></div><div class="status-row"><span>Next</span><b>Create it with ORACLE</b></div></div></aside>`;
    }
    return `<aside class="world-card product-card"><p class="eyebrow">${release ? 'ACTIVE PRODUCT' : 'YOUR FIRST APP'}</p><h2>ClearRead ${escapeHTML(state.product.version)}</h2><div class="product-status"><div class="status-row"><span>Created by</span><b>The Founder</b></div><div class="status-row"><span>Photos tested</span><b>${state.product.evidence.length}</b></div><div class="status-row"><span>Release</span><b>${release ? escapeHTML(release.label) : 'Not released'}</b></div><div class="status-row"><span>Market result</span><b class="pending">${release ? 'Pending' : '—'}</b></div></div></aside>`;
  }

  function renderWorld() {
    const released = Boolean(state.product.release);
    // Settlement is layered over the garage. Derive its backdrop from the
    // current day so a Day 8 receipt never sits over Day 7 copy.
    const morning = state.day === 8;
    const day8Done = Boolean(state.day8Update);
    const heading = morning ? day8Done ? 'The clinic stays covered.' : state.day8Deferred ? 'The clinic request is still open.' : 'The clinic is waiting.' : released ? 'Back in the garage.' : 'Build your first app.';
    const body = morning
      ? day8Done
        ? `ClearRead ${state.product.version} kept yesterday's rules and passed the Westside Clinic outage test. Its market response remains pending.`
        : state.day8Deferred
          ? 'You spent nothing on the outage request. Westside Clinic will ask again tomorrow.'
          : `ClearRead ${state.product.version} is still active. Westside Clinic needs it to work when the connection drops.`
      : released
        ? `ClearRead ${state.product.version} is recorded. Its market result is pending, and the rest of Day 7 is still yours.`
        : 'USER_0047 brought you a real problem. You have an empty project and a name for it: ClearRead.';
    const actions = morning
      ? day8Done || state.day8Deferred
        ? `${action('record', 'Open company record', 'See both saved product passes.', 'primary')}${action('end-day', 'End Day 8', 'Close the second day when you choose.', 'end-day')}`
        : `${action('enter-day8-oracle', 'Answer the clinic', 'Choose whether to update ClearRead today.', 'primary')}`
      : released
        ? `${action('record', 'Open company record', 'Review the active build and pending exposure.', 'primary')}${action('end-day', 'End Day 7', 'Close the books when you choose.', 'end-day')}`
        : `${action('enter-oracle', 'Enter ORACLE Studio', 'Decide how ClearRead should behave.', 'primary')}`;
    $('surface').innerHTML = `<div class="world"><div class="world-bg"></div><div class="world-shade"></div><div class="world-grid"><section class="world-card"><p class="eyebrow">${morning ? 'GARAGE HQ · DAY 8' : 'GARAGE HQ · DAY 7'}</p><h1>${heading}</h1><p class="lede">${escapeHTML(body)}</p><div class="world-actions">${actions}</div></section><img class="world-founder sprite" src="${ASSETS.founderSprite}" alt="The Founder standing in the pixel-art garage">${worldProductCard()}</div></div>`;
    $('status-line').textContent = morning ? 'Day 8 · carried company state' : released ? 'Garage HQ · release pending' : 'Garage HQ · choose a station';
  }

  function renderDialogue(day = state.day) {
    const copy = `<p class="eyebrow">23:58 · YOUR FIRST CUSTOMER</p><h1>“The box says half.”</h1><div class="messages"><div class="message"><b>USER_0047</b> · Grandma started new blood-pressure pills. The glossy label looked like it said two.</div><div class="message">Could you build something that reads it aloud—and refuses when it cannot see the whole dose?</div></div><p class="lede">You name the idea ClearRead. This will be your first app.</p><div class="choices">${choice('continue-customer', 'Design ClearRead', 'Tell ORACLE exactly how it should respond.', '', true)}</div>`;
    oracleShell(ASSETS.user, 'USER_0047, the customer who inspires ClearRead', copy);
    $('status-line').textContent = 'Customer dialogue · the idea for ClearRead';
  }

  function oracleShell(portrait, alt, copy, pixel = false, portraitClass = '') {
    const portraitMarkup = portraitClass === 'dev-decisive'
      ? `<div class="portrait dev-decisive" role="img" aria-label="${escapeHTML(alt)}"></div>`
      : `<img class="portrait${portraitClass ? ` ${portraitClass}` : ''}" src="${portrait}" alt="${escapeHTML(alt)}">`;
    $('surface').innerHTML = `<div class="oracle"><div class="oracle-bg${pixel ? ' pixel' : ''}"></div>${portraitMarkup}<article class="oracle-panel"><div class="copy">${copy}</div></article></div>`;
    $('status-line').textContent = `ORACLE workflow · ${state.oracleStage}`;
  }

  function renderQuestion() {
    const question = QUESTIONS[state.question];
    const first = state.question === 0;
    const copy = `<p class="eyebrow">ORACLE · DECISION ${state.question + 1} OF 2</p><h1>${escapeHTML(question.title)}</h1>${first ? '<p class="lede">Choose what a customer should actually hear and see.</p>' : ''}<div class="choices">${question.options.map(item => choice('answer', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }

  function renderBrief() {
    const copy = `<p class="eyebrow">ORACLE · BUILD PLAN</p><h1>ClearRead will follow these four rules.</h1>${behaviorList()}<p class="cost">Buy 200 AI Credits for ${money(ECONOMY.day7PackPrice)} · use 80⚡ · 60 minutes · 1 Focus</p><div class="choices">${choice('buy-build', `Buy Credits and create ClearRead · ${money(ECONOMY.day7PackPrice)}`, '200 Credits added; 80 used for this build.', '', true)}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderBuild() {
    const copy = `<p class="eyebrow">FIRST BUILD SAVED · 0.1.0</p><h1>You created ClearRead.</h1><p class="lede">ClearRead now follows the four rules you chose. Try it on the photo that started this.</p>${behaviorList()}<div class="choices">${choice('test-incident', 'Try the customer’s photo', '30 minutes · 20⚡', '', true)}</div>`;
    oracleShell(ASSETS.buildScene, 'The Founder confidently creating ClearRead at a laptop', copy, false, 'scene-art');
  }
  function renderIncident() {
    const observed = state.answers.purpose === 'decline' ? 'ClearRead refused and explained the glare.' : state.answers.proof === 'review' ? 'ClearRead held speech for a reviewer.' : state.answers.purpose === 'fragments' ? 'ClearRead spoke only confirmed text.' : 'ClearRead withheld the hidden dosage.';
    const copy = `<p class="eyebrow">FIRST PHOTO · PASSED</p><h1>It handles the original photo.</h1>${result(true, 'Customer’s glossy label', observed)}<div class="dev-line"><img src="${ASSETS.dev}" alt="Dev"><p><b>Dev:</b> “The first photo worked. I want to try a second, clear photo. A new photo should never reuse the old answer.”</p></div><div class="choices">${choice('test-second-photo', 'Try the second photo', '30 minutes · 20⚡', '', true)}${choice('release-one-test', 'Release after one test', 'Save time; repeat scans remain untested.')}</div>`;
    oracleShell(ASSETS.user, 'USER_0047', copy);
  }
  function releaseChoices() {
    const tested = state.product.evidence.length > 1 ? 'both tested photos' : 'the one tested photo';
    return `<div class="scope"><span>TESTED · ${escapeHTML(tested)}</span><span>NOT TESTED · other photos and settings</span></div><div class="choices">${choice('release', 'Release only where it was tested', 'Keep this build inside the conditions that worked.', 'evidence')}${choice('release', 'Release to the wider market', 'Let more people use it before those situations are tested.', 'wide')}</div>`;
  }
  function renderAdjacent() {
    const fixture = FIXTURES[state.fixtureId];
    if (state.fixturePass) {
      const copy = `<p class="eyebrow">SECOND PHOTO · PASSED</p><h1>The new photo gets a new answer.</h1>${result(true, fixture.title, fixture.observed)}<p class="lede"><b>Dev:</b> “Both photos work. Now decide how widely to release this build.”</p>${releaseChoices()}`;
      oracleShell(ASSETS.devExpressions, 'Dev, the technical cofounder', copy, true, 'dev-decisive');
      return;
    }
    const unsupported = state.unsupportedDiagnosis ? `<div class="unsupported"><b>That does not match what happened.</b><br>${escapeHTML(fixture.unsupported)}</div>` : '';
    const copy = `<p class="eyebrow">SECOND PHOTO · FAILED</p><h1>ClearRead repeated the first dose.</h1>${result(false, fixture.title, fixture.observed)}<div class="trace"><b>What we saw:</b> ${escapeHTML(fixture.cause)}</div><p class="lede"><b>Dev:</b> “The camera was clear. Something from the first scan stayed behind.”</p>${unsupported}<p class="prompt">What went wrong?</p><div class="choices">${fixture.diagnoses.map(item => choice('diagnose', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.devExpressions, 'Dev, the technical cofounder', copy, true, 'dev-decisive');
  }
  function renderPatch() {
    const fixture = FIXTURES[state.fixtureId];
    const diagnosis = fixture.diagnoses.find(item => item.id === state.diagnosis);
    const copy = `<p class="eyebrow">ORACLE · FIX THE REPEAT SCAN</p><h1>How should ClearRead start a new photo?</h1><p class="lede">You found the problem: ${escapeHTML(diagnosis.label)}. The original four rules will stay unchanged.</p><div class="choices">${fixture.patches.map(item => choice('patch', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRevised() {
    const fixture = FIXTURES[state.fixtureId];
    const copy = `<p class="eyebrow">BOTH PHOTOS TESTED · 0.1.1</p><h1>Both photos now work.</h1>${result(true, 'Original glossy label', 'ClearRead follows the rules you chose.')}${result(true, fixture.title, 'ClearRead forgets the first photo before reading the second.')}<div class="preserved">THE FOUR CHOSEN RULES STAYED INTACT</div><div class="added">+ ${escapeHTML(state.product.implementationBoundary)}</div>${releaseChoices()}`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRelease() {
    const copy = `<p class="eyebrow">RELEASE · ${state.product.version}</p><h1>How widely should ClearRead launch?</h1><p class="lede">One customer photo worked. You chose not to check whether a second photo starts a fresh reading.</p>${releaseChoices()}`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
  }
  function renderDay8Question() {
    const copy = `<p class="eyebrow">08:42 · WESTSIDE CLINIC</p><h1>“The Wi-Fi dropped again.”</h1><div class="messages"><div class="message">Fourteen patients lost label reading when the clinic's connection failed.</div></div><p class="lede">Choose what ClearRead should do without a connection—or leave this request for another day.</p><div class="choices">${DAY8_OPTIONS.map(item => choice('day8-answer', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }

  function renderDay8Brief() {
    const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
    const copy = `<p class="eyebrow">ORACLE · DAY 8 BUILD PLAN</p><h1>Add the offline rule. Keep everything else.</h1>${behaviorList(true)}<div class="added">+ ${escapeHTML(selected.line)}</div><p class="cost">Buy 200 AI Credits for ${money(ECONOMY.day8PackPrice)} · use 200⚡ · 90 minutes · 1 Focus</p><div class="choices">${choice('day8-buy-build', `Buy Credits and build the update · ${money(ECONOMY.day8PackPrice)}`, 'The clinic test runs automatically; all 200 Credits are used.', '', true)}</div>`;
    oracleShell(ASSETS.founder, 'The confident Founder holding a laptop', copy, true);
  }

  function recordMarkup() {
    const release = state.product.release;
    const behaviors = state.product.behaviors.map(line => `<li>${escapeHTML(line)}</li>`).join('');
    const boundary = state.product.implementationBoundary ? `<li>${escapeHTML(state.product.implementationBoundary)}</li>` : '';
    const evidence = state.product.evidence.map(item => `<li>${escapeHTML(item.label)} · ${item.result}</li>`).join('');
    const future = state.product.futureScenarios.map(item => `<li>${escapeHTML(item)}</li>`).join('');
    const day8 = state.day8Update ? `<div class="exposure"><b>DAY 8 UPDATE · ${escapeHTML(state.day8Update.behavior)}</b><br>Outage replay passed. Market response remains pending.</div>` : '';
    return `<p class="eyebrow">COMPANY RECORD</p><h1>ClearRead ${escapeHTML(state.product.version)}</h1><p class="lede">You created this app. This is the exact state later days and scenarios receive.</p><div class="record-grid"><section class="record-section"><h3>Active behavior</h3><ul>${behaviors}${boundary}</ul></section><section class="record-section"><h3>Recorded evidence</h3><ul>${evidence}</ul></section></div><div class="exposure"><b>${escapeHTML(release.label)}</b><br>${release.scope === 'wide' ? 'Future scenario selection may now draw from untested contexts. Features remain unchanged.' : 'Future scenario selection stays inside demonstrated conditions.'}<ul>${future}</ul></div>${day8}`;
  }
  function renderRecord() {
    renderWorld();
    $('surface').insertAdjacentHTML('beforeend', `<div class="modal-wrap"><section class="modal">${recordMarkup()}<div class="world-actions">${action('close-record', 'Back to Garage HQ', 'Keep the record and continue the day.', 'primary')}</div></section></div>`);
    $('status-line').textContent = 'Company record · persistent product state';
  }
  function renderSettlement() {
    const ledger = state.settlements.find(item => item.day === state.day) || settlementForState(state);
    const day8 = state.day === 8;
    const purchase = state.purchases.find(item => item.day === state.day);
    renderWorld();
    $('surface').insertAdjacentHTML('beforeend', `<div class="modal-wrap"><section class="modal"><p class="eyebrow">END DAY · SETTLEMENT</p><h1>Day ${state.day} closes here.</h1><p class="lede">Product work ended earlier. This separate action closes the company books.</p><div class="ledger"><div class="ledger-row"><span>Opening cash</span><b>${money(ledger.opening)}</b></div>${purchase ? `<div class="ledger-row pain"><span>${purchase.credits} AI Credits</span><b>−${money(purchase.cash)}</b></div>` : ''}<div class="ledger-row"><span>${ledger.users} users × $0.09</span><b>+${money(ledger.revenue)}</b></div><div class="ledger-row"><span>AI operations · ${ledger.users} active users</span><b>−${money(ledger.aiCost)}</b></div><div class="ledger-row"><span>Rent and tools</span><b>−${money(ledger.fixed)}</b></div><div class="ledger-row"><span>Market response</span><b>Pending</b></div><div class="ledger-row total"><span>Closing cash</span><b>${money(ledger.closing)}</b></div></div>${day8 ? `<div class="market-note"><span>TWO-DAY COMPUTE RECEIPT</span><strong>Day 7 Credits: ${money(ECONOMY.day7PackPrice)} · Day 8 Credits: ${money(ECONOMY.day8PackPrice)}</strong><small>The same ${ECONOMY.creditPack}-Credit pack cost ${money(ECONOMY.day8PackPrice - ECONOMY.day7PackPrice)} more after the 1.5× market shock.</small></div>` : `<div class="market-note"><span>DAY 8 · COMPUTE MARKET SHOCK</span><strong>Unit inference and Credit prices: 1.0× → 1.5×</strong><small>At the same 84-user usage: ${money(ledger.aiCost)}/day → ${money(ledger.day8AI)}/day.</small><small>Your remaining prepaid Credits stay intact. The next ${ECONOMY.creditPack}-Credit pack rises from ${money(ECONOMY.day7PackPrice)} to ${money(ECONOMY.day8PackPrice)}.</small></div>`}<div class="world-actions">${day8 ? action('restart', 'Replay the two-day experiment', 'Compare another product strategy.', 'primary') : action('begin-day8', 'Begin Day 8', 'Carry the saved build and release record forward.', 'primary')}</div></section></div>`);
    $('status-line').textContent = `End Day ${state.day} · settlement authority`;
  }

  function renderOracle() {
    const views = { question: renderQuestion, brief: renderBrief, build: renderBuild, incident: renderIncident, adjacent: renderAdjacent, patch: renderPatch, revised: renderRevised, release: renderRelease, day8Question: renderDay8Question, day8Brief: renderDay8Brief };
    (views[state.oracleStage] || renderQuestion)();
  }
  function render() {
    renderHud();
    if (state.view === 'dialogue') renderDialogue(7);
    else if (state.view === 'oracle') renderOracle();
    else if (state.view === 'record') renderRecord();
    else if (state.view === 'settlement') renderSettlement();
    else renderWorld();
  }

  function transition(view, stage = null) {
    state.view = view; state.oracleStage = stage; log('stage', stage || view); commit();
  }
  function handle(actionId, value) {
    if (actionId !== 'restart') state.taps += 1;
    if (actionId === 'continue-customer') {
      state.question = 0; transition('oracle', 'question');
    } else if (actionId === 'enter-oracle') {
      state.question = 0; transition('oracle', 'question');
    } else if (actionId === 'enter-day8-oracle') {
      transition('oracle', 'day8Question');
    } else if (actionId === 'answer') {
      const question = QUESTIONS[state.question];
      const selected = question.options.find(item => item.id === value);
      if (!selected) { toast('Choose one of the available responses.'); return; }
      Object.assign(state.answers, selected.answers); log('answer', `${question.id}:${value}`);
      if (state.question < QUESTIONS.length - 1) { state.question += 1; state.oracleStage = 'question'; commit(); }
      else transition('oracle', 'brief');
    } else if (actionId === 'buy-build') {
      if (!buyCredits(state)) { toast('Not enough cash for the Credit pack.'); return; }
      spend(COSTS.build); saveInitialBuild(state); log('credit-purchase', `${ECONOMY.creditPack}:${creditPackPrice(state.day)}`); log('build', '0.1.0'); transition('oracle', 'build');
    } else if (actionId === 'test-incident') {
      spend(COSTS.test); state.product.evidence = [{ id: 'glossy', label: 'Customer’s glossy label', result: 'pass' }]; log('test', 'glossy:pass'); transition('oracle', 'incident');
    } else if (actionId === 'test-second-photo') {
      spend(COSTS.test); const fixture = deriveAdjacent(state.answers); state.fixtureId = fixture.id; state.fixturePass = fixture.id === 'clean'; if (state.fixturePass) state.product.evidence.push({ id: fixture.id, label: fixture.title, result: 'pass' }); log('test', `${fixture.id}:${state.fixturePass ? 'pass' : 'fail'}`); transition('oracle', 'adjacent');
    } else if (actionId === 'release-one-test') {
      state.fixtureId = null; state.fixturePass = null; log('test-declined', 'second-photo'); transition('oracle', 'release');
    } else if (actionId === 'diagnose') {
      const fixture = FIXTURES[state.fixtureId]; log('diagnosis', `${fixture.id}:${value}`);
      if (value !== fixture.correctDiagnosis) { state.unsupportedDiagnosis = value; commit(); }
      else { state.diagnosis = value; state.unsupportedDiagnosis = null; transition('oracle', 'patch'); }
    } else if (actionId === 'patch') {
      if (!applyPatch(state, value)) { toast('That change does not match the problem you found.'); return; }
      spend(COSTS.revise); spend(COSTS.test); log('patch', `${state.fixtureId}:${value}`); log('retest', 'glossy:pass'); log('retest', `${state.fixtureId}:pass`); transition('oracle', 'revised');
    } else if (actionId === 'release') {
      const fixture = state.fixtureId ? FIXTURES[state.fixtureId] : null;
      const label = value === 'wide' ? 'Wider-market release' : 'Tested-conditions release';
      state.product.release = { scope: value, label, status: 'pending', day: state.day, build: state.product.version };
      state.product.futureScenarios = futureScenarioPool(value, fixture?.title || 'repeat scans');
      log('release', `${value}:${state.product.version}`); transition('world'); toast('Release recorded · market result pending');
    } else if (actionId === 'day8-answer') {
      if (value === 'defer') { state.day8Deferred = true; log('day8-deferred', 'clinic-offline'); transition('morning'); }
      else { state.day8Answer = value; log('day8-answer', value); transition('oracle', 'day8Brief'); }
    } else if (actionId === 'day8-buy-build') {
      const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
      if (!selected || !buyCredits(state)) { toast('Not enough cash for the Day 8 Credit pack.'); return; }
      spend(COSTS.day8Update); state.product.version = '0.2.0'; state.product.behaviors.push(selected.line); state.product.evidence.push({ id: 'offline', label: 'Westside Clinic outage', result: 'pass' }); state.day8Update = { behavior: selected.line, status: 'pending', build: '0.2.0' }; if (state.product.release) state.product.release.build = '0.2.0'; log('credit-purchase', `${ECONOMY.creditPack}:${creditPackPrice(state.day)}`); log('day8-build', selected.id); transition('morning'); toast('ClearRead 0.2.0 passed the clinic outage test');
    } else if (actionId === 'record') transition('record');
    else if (actionId === 'close-record') transition(state.day === 8 ? 'morning' : 'world');
    else if (actionId === 'end-day') {
      settleState(state); log('settlement', `cash:${state.cash}`); transition('settlement');
    } else if (actionId === 'begin-day8') {
      state.day = 8; state.minutes = 540; state.dayOpeningCash = state.cash; transition('oracle', 'day8Question');
    } else if (actionId === 'restart') restart();
  }

  function toast(message) {
    const element = $('toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 1800);
  }
  function restart() {
    state = freshState(); log('start', 'second-loop-03'); render(); save();
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }
    toast('Restarted Day 7 · 80⚡ · $700.00');
  }
  function boot() {
    state = load();
    if (!state.events.length) log('start', 'second-loop-03');
    $('surface').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button && !button.disabled) handle(button.dataset.action, button.dataset.value || '');
    });
    $('reset-button').addEventListener('click', restart);
    render(); save();
  }

  const api = { ASSETS, ECONOMY, COSTS, QUESTIONS, FIXTURES, DAY8_OPTIONS, freshState, chosenLines, deriveAdjacent, inferenceCost, approvedSettlement, creditPackPrice, buyCredits, saveInitialBuild, settlementForState, futureScenarioPool, applyPatch, settleState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.__secondLoopExperiment = { getState: () => state, reset: restart, mechanics: api };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
}());
