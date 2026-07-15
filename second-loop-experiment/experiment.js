'use strict';

(function () {
  const ROOT = '..';
  const STORAGE_KEY = 'vcs_second_loop_state_v3';
  const SCHEMA_VERSION = 3;
  const ASSETS = Object.freeze({
    night: `${ROOT}/ChatGPT/UI-UX/backgrounds/BG-12/bg-12-dark-night-garage-v1.png`,
    garage: `${ROOT}/ChatGPT/R-assets/pixel-drafts/tilesets/Garage/garage-tileset-tier-2-v1.png`,
    user: `${ROOT}/ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png`,
    oracle: `${ROOT}/ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png`,
    founder: `${ROOT}/ChatGPT/R-assets/founder/PC-01a/pc-01a-v2.png`,
    buildScene: `${ROOT}/assets/scenes/founder-vibe-coding/pc-01-vibe-code-first-app-success-v1.png`,
    dev: `${ROOT}/ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png`,
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
    { id: 'sync', label: 'Save the photo for later', note: 'Queue it only after the user agrees.', line: 'With consent, queue the photo until the connection returns.' }
  ]);

  const QUESTIONS = Object.freeze([
    { id: 'purpose', title: 'What should ClearRead do?', options: [
      { id: 'exact', label: 'Read exact dosage', note: 'Only when the full line is clear.', line: 'Read the exact dosage when the full line is visible.' },
      { id: 'fragments', label: 'Read confirmed fragments', note: 'Speak only text it can prove.', line: 'Read only confirmed fragments of the label.' },
      { id: 'decline', label: 'Refuse and explain', note: 'Name why the image cannot be read.', line: 'Refuse unreadable dosage and explain why.' }
    ]},
    { id: 'condition', title: 'When does that rule activate?', options: [
      { id: 'glare', label: 'Glare crosses dosage', note: 'Narrow to this incident.', line: 'Activate when glare crosses the dosage line.' },
      { id: 'unreadable', label: 'Key text is unreadable', note: 'Use a broader evidence gate.', line: 'Activate when any critical text is unreadable.' },
      { id: 'medical', label: 'Medicine-label mode', note: 'Protect this product context.', line: 'Activate for uncertain text in medicine-label mode.' }
    ]},
    { id: 'proof', title: 'How will you prove it worked?', options: [
      { id: 'retake', label: 'Retake shows full dosage', note: 'Prove recovery end to end.', line: 'A fresh photo produces the complete dosage.' },
      { id: 'silent', label: 'Same photo triggers refusal', note: 'Prove no wrong speech.', line: 'The incident photo produces a clear refusal.' },
      { id: 'review', label: 'Human review confirms label', note: 'Prove with a second reader.', line: 'A reviewer confirms the dosage before speech.' }
    ]},
    { id: 'fallback', title: 'Which fallback should take over?', options: [
      { id: 'silent', label: 'Stay silent', note: 'Block unproven medicine text.', line: 'When evidence remains uncertain, stay silent rather than guess.' },
      { id: 'fresh', label: 'Request a fresh scan', note: 'Start again with new evidence.', line: 'When evidence remains uncertain, request a fresh scan.' },
      { id: 'review', label: 'Ask for human review', note: 'Share only after explicit consent.', line: 'When evidence remains uncertain, offer consent-based human review.' }
    ]}
  ]);

  const FIXTURES = Object.freeze({
    stale: {
      id: 'stale', title: 'Second-photo session', observed: 'The retake reused the first scan.',
      cause: 'Recovery changed, but scan memory did not.', correctDiagnosis: 'memory',
      diagnoses: [
        { id: 'memory', label: 'Old scan survived', note: 'The retake did not start a fresh session.' },
        { id: 'camera', label: 'Camera stayed blurred', note: 'The new image may still be unclear.' }
      ],
      unsupported: 'Blur does not explain why data from the first scan reappeared.',
      patches: [
        { id: 'clear', label: 'Clear scan memory', note: 'Start every retake from new evidence.', line: 'Start each retake from a fresh scan.' },
        { id: 'decline', label: 'Decline mixed sessions', note: 'Refuse when scan identity is uncertain.', line: 'Decline when a retake contains mixed scan state.' }
      ]
    },
    handwriting: {
      id: 'handwriting', title: 'Readable handwriting', observed: 'The broad gate rejected a readable note.',
      cause: 'Printed labels and handwriting entered one evidence gate.', correctDiagnosis: 'branch',
      diagnoses: [
        { id: 'branch', label: 'No handwriting branch', note: 'Different evidence entered one condition.' },
        { id: 'network', label: 'The network was slow', note: 'The request may have timed out.' }
      ],
      unsupported: 'The trace records a completed rejection, not a network timeout.',
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
  const option = (questionId, answerId) => QUESTIONS.find(question => question.id === questionId)?.options.find(item => item.id === answerId);
  const chosenLines = answers => QUESTIONS.map(question => option(question.id, answers[question.id])?.line).filter(Boolean);

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
      dayOpeningCash: ECONOMY.openingCash, day8Answer: null, day8Update: null,
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
    return `<aside class="world-card product-card"><p class="eyebrow">${release ? 'ACTIVE PRODUCT' : 'YOUR FIRST APP'}</p><h2>ClearRead ${escapeHTML(state.product.version)}</h2><div class="product-status"><div class="status-row"><span>Created by</span><b>The Founder</b></div><div class="status-row"><span>Evidence</span><b>${state.product.evidence.length}/${state.day8Update ? 3 : 2} fixtures</b></div><div class="status-row"><span>Release</span><b>${release ? escapeHTML(release.label) : 'Needs a fix'}</b></div><div class="status-row"><span>Market result</span><b class="pending">${release ? 'Pending' : '—'}</b></div></div></aside>`;
  }

  function renderWorld() {
    const released = Boolean(state.product.release);
    const morning = state.view === 'morning';
    const day8Done = Boolean(state.day8Update);
    const needsTopUp = state.day === 7 ? state.credits < 120 : state.credits < COSTS.day8Update.credits;
    const heading = morning ? day8Done ? 'The second build is recorded.' : 'The clinic is waiting.' : released ? 'Back in the garage.' : 'Build your first app.';
    const body = morning
      ? day8Done
        ? `ClearRead ${state.product.version} now carries yesterday's behaviors and today's offline rule. Its market response remains pending.`
        : `ClearRead ${state.product.version} is still active. Westside Clinic needs it to work when the connection drops.`
      : released
        ? `ClearRead ${state.product.version} is recorded. Its market result is pending, and the rest of Day 7 is still yours.`
        : 'USER_0047 brought you a real problem. You have an empty project and a name for it: ClearRead.';
    const topUp = action('buy-credits', `Buy ${ECONOMY.creditPack} AI Credits · ${money(creditPackPrice(state.day))}`, state.day === 8 ? 'The same pack now costs 50% more cash.' : 'Enough capacity to build, test and revise.', 'buy-credits');
    const actions = morning
      ? day8Done
        ? `${action('record', 'Open company record', 'See both saved product passes.', 'primary')}${action('end-day', 'End Day 8', 'Close the second day when you choose.', 'end-day')}`
        : `${needsTopUp ? topUp : ''}${action('enter-day8-oracle', 'Build the offline update', `${COSTS.day8Update.minutes} minutes · ${COSTS.day8Update.credits}⚡ · ${COSTS.day8Update.focus} Focus`, 'primary', needsTopUp)}`
      : released
        ? `${action('record', 'Open company record', 'Review the active build and pending exposure.', 'primary')}${action('end-day', 'End Day 7', 'Close the books when you choose.', 'end-day')}`
        : `${needsTopUp ? topUp : ''}${action('enter-oracle', 'Enter ORACLE Studio', 'Define, build, test and record a release.', 'primary', needsTopUp)}`;
    $('surface').innerHTML = `<div class="world"><div class="world-bg"></div><div class="world-shade"></div><div class="world-grid"><section class="world-card"><p class="eyebrow">${morning ? 'GARAGE HQ · DAY 8' : 'GARAGE HQ · DAY 7'}</p><h1>${heading}</h1><p class="lede">${escapeHTML(body)}</p><div class="world-actions">${actions}</div></section><img class="world-founder sprite" src="${ASSETS.founderSprite}" alt="The Founder standing in the pixel-art garage">${worldProductCard()}</div></div>`;
    $('status-line').textContent = morning ? 'Day 8 · carried company state' : released ? 'Garage HQ · release pending' : 'Garage HQ · choose a station';
  }

  function renderDialogue(day = state.day) {
    const day8 = day === 8;
    const copy = day8
      ? `<p class="eyebrow">08:42 · WESTSIDE CLINIC</p><h1>“The Wi-Fi dropped again.”</h1><div class="messages"><div class="message"><b>USER_0047</b> · The clinic is using the ClearRead app you built.</div><div class="message">When the connection vanished, fourteen patients lost label reading with it.</div></div><p class="lede">Yesterday's build is still live. Today, the same compute pack costs 50% more.</p><div class="choices">${choice('continue-day8', 'Take the call', 'Return to the garage with this new problem.', '', true)}</div>`
      : `<p class="eyebrow">23:58 · YOUR FIRST CUSTOMER</p><h1>“The box says half.”</h1><div class="messages"><div class="message"><b>USER_0047</b> · Grandma started new blood-pressure pills. The glossy label looked like it said two.</div><div class="message">Could you build something that reads it aloud—and refuses when it cannot see the whole dose?</div></div><p class="lede">Back in the garage, you name the idea ClearRead. This will be your first app.</p><div class="choices">${choice('continue-customer', 'Build ClearRead', 'Take her problem back to your garage.', '', true)}</div>`;
    oracleShell(ASSETS.user, 'USER_0047, the customer who inspires ClearRead', copy);
    $('status-line').textContent = day8 ? 'Customer dialogue · Day 8' : 'Customer dialogue · the idea for ClearRead';
  }

  function oracleShell(portrait, alt, copy, pixel = false, portraitClass = '') {
    $('surface').innerHTML = `<div class="oracle"><div class="oracle-bg${pixel ? ' pixel' : ''}"></div><img class="portrait${portraitClass ? ` ${portraitClass}` : ''}" src="${portrait}" alt="${escapeHTML(alt)}"><article class="oracle-panel"><div class="copy">${copy}</div></article></div>`;
    $('status-line').textContent = `ORACLE workflow · ${state.oracleStage}`;
  }

  function renderQuestion() {
    const question = QUESTIONS[state.question];
    const first = state.question === 0;
    const copy = `<p class="eyebrow">ORACLE · QUESTION ${state.question + 1} OF 4</p><h1>${escapeHTML(question.title)}</h1>${first ? '<p class="lede">Turn the customer\'s incident into observable product behavior.</p>' : ''}<div class="choices">${question.options.map(item => choice('answer', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }

  function renderBrief() {
    const copy = `<p class="eyebrow">ORACLE · EXACT READBACK</p><h1>This is what I’ll build.</h1>${behaviorList()}<p class="cost">60 minutes · 80⚡ · 1 Focus</p><div class="choices">${choice('build', 'Create ClearRead', 'Generate and save your first app as 0.1.0.', '', true)}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderBuild() {
    const copy = `<p class="eyebrow">FIRST BUILD SAVED · 0.1.0</p><h1>You created ClearRead.</h1><p class="lede">Your exact four behaviors are now software. Replay the customer’s photograph before anyone relies on it.</p>${behaviorList()}<div class="choices">${choice('test-incident', 'Replay customer photo', '30 minutes · 20⚡', '', true)}</div>`;
    oracleShell(ASSETS.buildScene, 'The Founder confidently creating ClearRead at a laptop', copy, false, 'scene-art');
  }
  function renderIncident() {
    const observed = state.answers.purpose === 'decline' ? 'ClearRead refused and explained the glare.' : state.answers.proof === 'review' ? 'ClearRead held speech for a reviewer.' : state.answers.purpose === 'fragments' ? 'ClearRead spoke only confirmed text.' : 'ClearRead withheld the hidden dosage.';
    const copy = `<p class="eyebrow">EVIDENCE · REPORTED PHOTO</p><h1>The incident closes.</h1>${result(true, 'Glossy dosage line', observed)}<p class="lede">Now test the nearest condition the saved brief did not establish.</p><div class="choices">${choice('test-adjacent', 'Test the adjacent case', '30 minutes · 20⚡', '', true)}</div>`;
    oracleShell(ASSETS.user, 'USER_0047', copy);
  }
  function renderAdjacent() {
    const fixture = FIXTURES[state.fixtureId];
    if (state.fixturePass) {
      const copy = `<p class="eyebrow">EVIDENCE · ADJACENT CASE</p><h1>The boundary holds.</h1>${result(true, fixture.title, fixture.observed)}<p class="lede"><b>Dev:</b> “Two fixtures. Same saved build.”</p><div class="choices">${choice('open-release', 'Record a release', 'Choose where this build can travel.', '', true)}</div>`;
      oracleShell(ASSETS.dev, 'Dev, the technical cofounder', copy, true);
      return;
    }
    const unsupported = state.unsupportedDiagnosis ? `<div class="unsupported"><b>That does not fit the trace.</b><br>${escapeHTML(fixture.unsupported)}</div>` : '';
    const copy = `<p class="eyebrow">EVIDENCE · ADJACENT CASE</p><h1>Why did this fail?</h1>${result(false, fixture.title, fixture.observed)}<div class="trace"><b>Trace:</b> ${escapeHTML(fixture.cause)}</div>${unsupported}<p class="prompt">Choose the cause supported by the trace.</p><div class="choices">${fixture.diagnoses.map(item => choice('diagnose', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.dev, 'Dev, the technical cofounder', copy, true);
  }
  function renderPatch() {
    const fixture = FIXTURES[state.fixtureId];
    const diagnosis = fixture.diagnoses.find(item => item.id === state.diagnosis);
    const copy = `<p class="eyebrow">ORACLE · FOCUSED REVISION</p><h1>Add the missing boundary.</h1><p class="lede">Diagnosis: ${escapeHTML(diagnosis.label)}. All four chosen behaviors remain saved.</p><div class="choices">${fixture.patches.map(item => choice('patch', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRevised() {
    const fixture = FIXTURES[state.fixtureId];
    const copy = `<p class="eyebrow">REGRESSION SUITE · 0.1.1</p><h1>Both fixtures pass.</h1>${result(true, 'Glossy dosage line', 'The customer’s photo now closes safely.')}${result(true, fixture.title, state.product.implementationBoundary)}<div class="preserved">4/4 CHOSEN BEHAVIORS PRESERVED</div><div class="added">+ ${escapeHTML(state.product.implementationBoundary)}</div><div class="choices">${choice('open-release', 'Record a release', 'Choose where this build can travel.', '', true)}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRelease() {
    const fixture = FIXTURES[state.fixtureId];
    const copy = `<p class="eyebrow">RELEASE · ${state.product.version}</p><h1>Where can this build travel?</h1><div class="scope"><span>PROVED · glossy label</span><span>PROVED · ${escapeHTML(fixture.title)}</span><span>UNTESTED · other contexts</span></div><div class="choices">${choice('release', 'Evidence-matched release', 'Use only the conditions proved here.', 'evidence')}${choice('release', 'Wider-market release', 'Allow future scenarios from untested contexts.', 'wide')}</div>`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
  }
  function renderPending() {
    const release = state.product.release;
    const copy = `<p class="eyebrow">RELEASE RECORDED · OUTCOME PENDING</p><h1>Product work is complete.</h1><div class="record"><strong>${escapeHTML(release.label)} · ${state.product.version}</strong><span>${clock(state.minutes)} · 2/2 fixtures held</span><p>The build and release scope are saved. No market result has been invented or applied.</p></div><div class="garage-return">Garage HQ still has the rest of your day. Settlement will happen only if you choose End Day.</div><div class="choices">${choice('return-garage', 'Return to Garage HQ', 'Carry this exact company state with you.', '', true)}</div>`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
  }

  function renderDay8Question() {
    const copy = `<p class="eyebrow">ORACLE · DAY 8 UPDATE</p><h1>What should ClearRead do offline?</h1><p class="lede">Choose one observable behavior for the clinic's connection failures.</p><div class="choices">${DAY8_OPTIONS.map(item => choice('day8-answer', item.label, item.note, item.id)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }

  function renderDay8Brief() {
    const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
    const copy = `<p class="eyebrow">ORACLE · UPDATE READBACK</p><h1>Add one behavior. Keep the rest.</h1>${behaviorList(true)}<div class="added">+ ${escapeHTML(selected.line)}</div><p class="cost">90 minutes · 200⚡ · 1 Focus</p><div class="choices">${choice('day8-build', 'Build and replay the outage', 'Generate ClearRead 0.2.0 and test it at the clinic.', '', true)}</div>`;
    oracleShell(ASSETS.founder, 'The confident Founder holding a laptop', copy, true);
  }

  function renderDay8Result() {
    const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
    const copy = `<p class="eyebrow">OUTAGE REPLAY · 0.2.0</p><h1>The clinic stays covered.</h1>${result(true, 'Connection lost', selected.line)}<div class="preserved">DAY 7 BUILD PRESERVED · DAY 8 RULE ADDED</div><div class="choices">${choice('day8-record', 'Record the Day 8 update', 'Return to Garage HQ with the result still pending.', '', true)}</div>`;
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
    const views = { question: renderQuestion, brief: renderBrief, build: renderBuild, incident: renderIncident, adjacent: renderAdjacent, patch: renderPatch, revised: renderRevised, release: renderRelease, pending: renderPending, day8Question: renderDay8Question, day8Brief: renderDay8Brief, day8Result: renderDay8Result };
    (views[state.oracleStage] || renderQuestion)();
  }
  function render() {
    renderHud();
    if (state.view === 'dialogue') renderDialogue(7);
    else if (state.view === 'day8Dialogue') renderDialogue(8);
    else if (state.view === 'oracle') renderOracle();
    else if (state.view === 'record') renderRecord();
    else if (state.view === 'settlement') renderSettlement();
    else renderWorld();
  }

  function transition(view, stage = null) {
    state.view = view; state.oracleStage = stage; log('stage', stage || view); commit();
  }
  function handle(actionId, value) {
    if (actionId === 'continue-customer') {
      transition('world');
    } else if (actionId === 'continue-day8') {
      transition('morning');
    } else if (actionId === 'buy-credits') {
      if (!buyCredits(state)) { toast('Not enough cash for this Credit pack.'); return; }
      log('credit-purchase', `${ECONOMY.creditPack}:${creditPackPrice(state.day)}`); commit(); toast(`${ECONOMY.creditPack} AI Credits added`);
    } else if (actionId === 'enter-oracle') {
      state.question = 0; transition('oracle', 'question');
    } else if (actionId === 'enter-day8-oracle') {
      transition('oracle', 'day8Question');
    } else if (actionId === 'answer') {
      const question = QUESTIONS[state.question]; state.answers[question.id] = value; state.taps += 1; log('answer', `${question.id}:${value}`);
      if (state.question < QUESTIONS.length - 1) { state.question += 1; state.oracleStage = 'question'; commit(); }
      else transition('oracle', 'brief');
    } else if (actionId === 'build') {
      state.taps += 1; spend(COSTS.build); saveInitialBuild(state); log('build', '0.1.0'); transition('oracle', 'build');
    } else if (actionId === 'test-incident') {
      state.taps += 1; spend(COSTS.test); state.product.evidence = [{ id: 'glossy', label: 'Glossy dosage line', result: 'pass' }]; log('test', 'glossy:pass'); transition('oracle', 'incident');
    } else if (actionId === 'test-adjacent') {
      state.taps += 1; spend(COSTS.test); const fixture = deriveAdjacent(state.answers); state.fixtureId = fixture.id; state.fixturePass = fixture.id === 'clean'; if (state.fixturePass) state.product.evidence.push({ id: fixture.id, label: fixture.title, result: 'pass' }); log('test', `${fixture.id}:${state.fixturePass ? 'pass' : 'fail'}`); transition('oracle', 'adjacent');
    } else if (actionId === 'diagnose') {
      state.taps += 1; const fixture = FIXTURES[state.fixtureId]; log('diagnosis', `${fixture.id}:${value}`);
      if (value !== fixture.correctDiagnosis) { state.unsupportedDiagnosis = value; commit(); }
      else { state.diagnosis = value; state.unsupportedDiagnosis = null; transition('oracle', 'patch'); }
    } else if (actionId === 'patch') {
      state.taps += 1;
      if (!applyPatch(state, value)) { toast('That patch is not supported by the diagnosis.'); return; }
      spend(COSTS.revise); spend(COSTS.test); log('patch', `${state.fixtureId}:${value}`); log('retest', 'glossy:pass'); log('retest', `${state.fixtureId}:pass`); transition('oracle', 'revised');
    } else if (actionId === 'open-release') {
      state.taps += 1; transition('oracle', 'release');
    } else if (actionId === 'release') {
      state.taps += 1; const fixture = FIXTURES[state.fixtureId]; const label = value === 'wide' ? 'Wider-market release' : 'Evidence-matched release'; state.product.release = { scope: value, label, status: 'pending', day: state.day, build: state.product.version }; state.product.futureScenarios = futureScenarioPool(value, fixture.title); log('release', `${value}:${state.product.version}`); transition('oracle', 'pending');
    } else if (actionId === 'return-garage') {
      state.taps += 1; transition('world');
    } else if (actionId === 'day8-answer') {
      state.taps += 1; state.day8Answer = value; log('day8-answer', value); transition('oracle', 'day8Brief');
    } else if (actionId === 'day8-build') {
      const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
      if (!selected || state.credits < COSTS.day8Update.credits) { toast('Top up AI Credits before building.'); return; }
      state.taps += 1; spend(COSTS.day8Update); state.product.version = '0.2.0'; state.product.behaviors.push(selected.line); state.product.evidence.push({ id: 'offline', label: 'Westside Clinic outage', result: 'pass' }); log('day8-build', selected.id); transition('oracle', 'day8Result');
    } else if (actionId === 'day8-record') {
      const selected = DAY8_OPTIONS.find(item => item.id === state.day8Answer);
      state.taps += 1; state.day8Update = { behavior: selected.line, status: 'pending', build: '0.2.0' }; state.product.release.build = '0.2.0'; log('day8-release', selected.id); transition('morning');
    } else if (actionId === 'record') transition('record');
    else if (actionId === 'close-record') transition(state.day === 8 ? 'morning' : 'world');
    else if (actionId === 'end-day') {
      settleState(state); log('settlement', `cash:${state.cash}`); transition('settlement');
    } else if (actionId === 'begin-day8') {
      state.day = 8; state.minutes = 540; state.dayOpeningCash = state.cash; transition('day8Dialogue');
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
