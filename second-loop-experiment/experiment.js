'use strict';

(function () {
  const ROOT = '..';
  const STORAGE_KEY = 'vcs_second_loop_state_v1';
  const SCHEMA_VERSION = 1;
  const ASSETS = Object.freeze({
    night: `${ROOT}/ChatGPT/UI-UX/backgrounds/BG-12/bg-12-dark-night-garage-v1.png`,
    garage: `${ROOT}/ChatGPT/R-assets/pixel-drafts/tilesets/Garage/garage-tileset-tier-2-v1.png`,
    user: `${ROOT}/ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png`,
    oracle: `${ROOT}/ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png`,
    founder: `${ROOT}/assets/generated/PC-01b/pc-01b-v2.png`,
    dev: `${ROOT}/ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png`,
    founderSprite: `${ROOT}/assets/generated/sprites/PC-01/frames/idle/front-01.png`
  });

  const ECONOMY = Object.freeze({
    openingCash: 560, users: 84, credits: 620, focus: 4,
    revenuePerUserDay: .09, aiDaily: 2.25, fixedDaily: 105,
    day8Multiplier: 1.5
  });
  const COSTS = Object.freeze({
    build: { minutes: 60, credits: 80, focus: 1 },
    test: { minutes: 30, credits: 20, focus: 0 },
    revise: { minutes: 45, credits: 36, focus: 1 }
  });

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

  function approvedSettlement(opening = ECONOMY.openingCash) {
    const revenue = roundMoney(ECONOMY.users * ECONOMY.revenuePerUserDay);
    return {
      opening, revenue, aiCost: ECONOMY.aiDaily, fixed: ECONOMY.fixedDaily,
      closing: roundMoney(opening + revenue - ECONOMY.aiDaily - ECONOMY.fixedDaily),
      users: ECONOMY.users, day8AI: roundMoney(ECONOMY.aiDaily * ECONOMY.day8Multiplier)
    };
  }

  function futureScenarioPool(scope, fixtureTitle) {
    return scope === 'wide'
      ? ['other languages', 'new label formats', 'untested lighting']
      : ['glossy medicine labels', fixtureTitle || 'tested adjacent condition'];
  }

  function freshState() {
    return {
      schema: SCHEMA_VERSION, view: 'world', oracleStage: null, question: 0,
      day: 7, minutes: 540, cash: ECONOMY.openingCash, users: ECONOMY.users,
      credits: ECONOMY.credits, focus: ECONOMY.focus, answers: {}, taps: 0,
      fixtureId: null, fixturePass: null, unsupportedDiagnosis: null,
      diagnosis: null, patch: null, settled: false,
      product: {
        name: 'ClearRead', version: null, behaviors: [], implementationBoundary: null,
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
    state.product.version = '0.7.6';
    state.product.implementationBoundary = patch.line;
    state.product.evidence = [
      { id: 'glossy', label: 'Glossy dosage line', result: 'pass' },
      { id: fixture.id, label: fixture.title, result: 'pass' }
    ];
    state.fixturePass = true;
    return true;
  }

  function settleState(state) {
    if (state.settled) return state;
    const ledger = approvedSettlement(state.cash);
    state.cash = ledger.closing;
    state.users = ledger.users;
    state.minutes = 1440;
    state.settled = true;
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
    const phaseIndex = state.view === 'oracle' ? 0 : state.view === 'settlement' || state.view === 'morning' ? 2 : state.product.release ? 1 : 0;
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
    if (!state.product.version) return `<aside class="world-card product-card"><p class="eyebrow">COMPANY RECORD</p><h2>No saved build yet</h2><p class="lede">Your product state will appear here after ORACLE generates it.</p></aside>`;
    const release = state.product.release;
    return `<aside class="world-card product-card"><p class="eyebrow">ACTIVE PRODUCT</p><h2>ClearRead ${escapeHTML(state.product.version)}</h2><div class="product-status"><div class="status-row"><span>Evidence</span><b>${state.product.evidence.length}/2 fixtures</b></div><div class="status-row"><span>Release</span><b>${release ? escapeHTML(release.label) : 'Not recorded'}</b></div><div class="status-row"><span>Market result</span><b class="pending">${release ? 'Pending' : '—'}</b></div></div></aside>`;
  }

  function renderWorld() {
    const released = Boolean(state.product.release);
    const morning = state.view === 'morning';
    const heading = morning ? 'Yesterday carried forward.' : released ? 'Back in the garage.' : 'A customer needs your help.';
    const body = morning
      ? `ClearRead ${state.product.version} is still active. Its behaviors, evidence and ${state.product.release.label.toLowerCase()} remain on the company record.`
      : released
        ? `ClearRead ${state.product.version} is recorded. Its market result is pending, and the rest of Day 7 is still yours.`
        : 'USER_0047 reports that ClearRead spoke the wrong dosage from a glossy medicine label.';
    const actions = morning
      ? `${action('record', 'Open company record', 'See exactly what survived the night.', 'primary')}${action('restart', 'Replay this experiment', 'Clear the local experiment state.')}`
      : released
        ? `${action('record', 'Open company record', 'Review the active build and pending exposure.', 'primary')}${action('end-day', 'End Day 7', 'Close the books when you choose.', 'end-day')}`
        : `${action('enter-oracle', 'Enter ORACLE Studio', 'Define, build, test and record a release.', 'primary')}`;
    $('surface').innerHTML = `<div class="world"><div class="world-bg"></div><div class="world-shade"></div><div class="world-grid"><section class="world-card"><p class="eyebrow">${morning ? 'GARAGE HQ · DAY 8' : 'GARAGE HQ · DAY 7'}</p><h1>${heading}</h1><p class="lede">${escapeHTML(body)}</p>${!released && !morning ? '<div class="incident"><b>USER_0047:</b> “The box says half. Grandma almost took two.”</div>' : ''}<div class="world-actions">${actions}</div></section><img class="world-founder" src="${ASSETS.founder}" alt="The Founder in an orange hoodie">${worldProductCard()}</div></div>`;
    $('status-line').textContent = morning ? 'Day 8 · carried company state' : released ? 'Garage HQ · release pending' : 'Garage HQ · choose a station';
  }

  function oracleShell(portrait, alt, copy, pixel = false) {
    $('surface').innerHTML = `<div class="oracle"><div class="oracle-bg${pixel ? ' pixel' : ''}"></div><img class="portrait" src="${portrait}" alt="${escapeHTML(alt)}"><article class="oracle-panel"><div class="copy">${copy}</div></article></div>`;
    $('status-line').textContent = `ORACLE workflow · ${state.oracleStage}`;
  }

  function renderQuestion() {
    const question = QUESTIONS[state.question];
    const first = state.question === 0;
    const incident = first ? '<div class="messages"><div class="message"><b>USER_0047</b> · ClearRead spoke the wrong dose from a glossy label.</div><div class="message">The box says half. Grandma almost took two.</div></div>' : '';
    const copy = `<p class="eyebrow">${first ? '23:58 · INCIDENT' : `ORACLE · QUESTION ${state.question + 1} OF 4`}</p><h1>${escapeHTML(question.title)}</h1>${incident}<div class="choices">${question.options.map((item, index) => choice('answer', item.label, item.note, item.id, first && index === 0)).join('')}</div>`;
    oracleShell(first ? ASSETS.user : ASSETS.oracle, first ? 'USER_0047' : 'ORACLE', copy, !first);
  }

  function renderBrief() {
    const copy = `<p class="eyebrow">ORACLE · EXACT READBACK</p><h1>This is what I’ll build.</h1>${behaviorList()}<p class="cost">60 minutes · 80⚡ · 1 Focus</p><div class="choices">${choice('build', 'Generate and save', 'Create ClearRead 0.7.5.', '', true)}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderBuild() {
    const copy = `<p class="eyebrow">BUILD SAVED · 0.7.5</p><h1>Your words became software.</h1><p class="lede">The exact four behaviors are now part of ClearRead. Replay the reported photograph.</p>${behaviorList()}<div class="choices">${choice('test-incident', 'Replay reported photo', '30 minutes · 20⚡', '', true)}</div>`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
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
    const copy = `<p class="eyebrow">ORACLE · FOCUSED REVISION</p><h1>Add the missing boundary.</h1><p class="lede">Diagnosis: ${escapeHTML(diagnosis.label)}. All four chosen behaviors remain saved.</p><div class="choices">${fixture.patches.map((item, index) => choice('patch', item.label, item.note, item.id, index === 0)).join('')}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRevised() {
    const fixture = FIXTURES[state.fixtureId];
    const copy = `<p class="eyebrow">REGRESSION SUITE · 0.7.6</p><h1>Both fixtures pass.</h1>${result(true, 'Glossy dosage line', 'The original incident still closes.')}${result(true, fixture.title, state.product.implementationBoundary)}<div class="preserved">4/4 CHOSEN BEHAVIORS PRESERVED</div><div class="added">+ ${escapeHTML(state.product.implementationBoundary)}</div><div class="choices">${choice('open-release', 'Record a release', 'Choose where this build can travel.', '', true)}</div>`;
    oracleShell(ASSETS.oracle, 'ORACLE', copy, true);
  }
  function renderRelease() {
    const fixture = FIXTURES[state.fixtureId];
    const copy = `<p class="eyebrow">RELEASE · ${state.product.version}</p><h1>Where can this build travel?</h1><div class="scope"><span>PROVED · glossy label</span><span>PROVED · ${escapeHTML(fixture.title)}</span><span>UNTESTED · other contexts</span></div><div class="choices">${choice('release', 'Evidence-matched release', 'Use only the conditions proved here.', 'evidence', true)}${choice('release', 'Wider-market release', 'Allow future scenarios from untested contexts.', 'wide')}</div>`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
  }
  function renderPending() {
    const release = state.product.release;
    const copy = `<p class="eyebrow">RELEASE RECORDED · OUTCOME PENDING</p><h1>Product work is complete.</h1><div class="record"><strong>${escapeHTML(release.label)} · ${state.product.version}</strong><span>${clock(state.minutes)} · 2/2 fixtures held</span><p>The build and release scope are saved. No market result has been invented or applied.</p></div><div class="garage-return">Garage HQ still has the rest of your day. Settlement will happen only if you choose End Day.</div><div class="choices">${choice('return-garage', 'Return to Garage HQ', 'Carry this exact company state with you.', '', true)}</div>`;
    oracleShell(ASSETS.founder, 'The Founder in an orange hoodie', copy, true);
  }

  function recordMarkup() {
    const release = state.product.release;
    const behaviors = state.product.behaviors.map(line => `<li>${escapeHTML(line)}</li>`).join('');
    const boundary = state.product.implementationBoundary ? `<li>${escapeHTML(state.product.implementationBoundary)}</li>` : '';
    const evidence = state.product.evidence.map(item => `<li>${escapeHTML(item.label)} · ${item.result}</li>`).join('');
    const future = state.product.futureScenarios.map(item => `<li>${escapeHTML(item)}</li>`).join('');
    return `<p class="eyebrow">COMPANY RECORD</p><h1>ClearRead ${escapeHTML(state.product.version)}</h1><p class="lede">This is the state later days and scenarios receive.</p><div class="record-grid"><section class="record-section"><h3>Active behavior</h3><ul>${behaviors}${boundary}</ul></section><section class="record-section"><h3>Recorded evidence</h3><ul>${evidence}</ul></section></div><div class="exposure"><b>${escapeHTML(release.label)}</b><br>${release.scope === 'wide' ? 'Future scenario selection may now draw from untested contexts. Features remain unchanged.' : 'Future scenario selection stays inside demonstrated conditions.'}<ul>${future}</ul></div>`;
  }
  function renderRecord() {
    renderWorld();
    $('surface').insertAdjacentHTML('beforeend', `<div class="modal-wrap"><section class="modal">${recordMarkup()}<div class="world-actions">${action('close-record', 'Back to Garage HQ', 'Keep the record and continue the day.', 'primary')}</div></section></div>`);
    $('status-line').textContent = 'Company record · persistent product state';
  }
  function renderSettlement() {
    const ledger = approvedSettlement();
    renderWorld();
    $('surface').insertAdjacentHTML('beforeend', `<div class="modal-wrap"><section class="modal"><p class="eyebrow">END DAY · SETTLEMENT</p><h1>Day 7 closes here.</h1><p class="lede">Product work ended earlier. This separate action closes the company books.</p><div class="ledger"><div class="ledger-row"><span>Opening cash</span><b>${money(ledger.opening)}</b></div><div class="ledger-row"><span>84 users × $0.09</span><b>+${money(ledger.revenue)}</b></div><div class="ledger-row"><span>AI operations</span><b>−${money(ledger.aiCost)}</b></div><div class="ledger-row"><span>Rent and tools</span><b>−${money(ledger.fixed)}</b></div><div class="ledger-row"><span>Market response</span><b>Pending</b></div><div class="ledger-row total"><span>Closing cash</span><b>${money(ledger.closing)}</b></div></div><div class="market-note"><span>DAY 8 · MARKET NOTICE</span><strong>Inference cost multiplier: 1.0× → 1.5×</strong><small>${money(ledger.aiCost)}/day becomes ${money(ledger.day8AI)}/day.</small></div><div class="world-actions">${action('begin-day8', 'Begin Day 8', 'Carry the saved build and release record forward.', 'primary')}</div></section></div>`);
    $('status-line').textContent = 'End Day · settlement authority';
  }

  function renderOracle() {
    const views = { question: renderQuestion, brief: renderBrief, build: renderBuild, incident: renderIncident, adjacent: renderAdjacent, patch: renderPatch, revised: renderRevised, release: renderRelease, pending: renderPending };
    (views[state.oracleStage] || renderQuestion)();
  }
  function render() {
    renderHud();
    if (state.view === 'oracle') renderOracle();
    else if (state.view === 'record') renderRecord();
    else if (state.view === 'settlement') renderSettlement();
    else renderWorld();
  }

  function transition(view, stage = null) {
    state.view = view; state.oracleStage = stage; log('stage', stage || view); commit();
  }
  function handle(actionId, value) {
    if (actionId === 'enter-oracle') {
      state.question = 0; transition('oracle', 'question');
    } else if (actionId === 'answer') {
      const question = QUESTIONS[state.question]; state.answers[question.id] = value; state.taps += 1; log('answer', `${question.id}:${value}`);
      if (state.question < QUESTIONS.length - 1) { state.question += 1; state.oracleStage = 'question'; commit(); }
      else transition('oracle', 'brief');
    } else if (actionId === 'build') {
      state.taps += 1; spend(COSTS.build); state.product.version = '0.7.5'; state.product.behaviors = chosenLines(state.answers); log('build', '0.7.5'); transition('oracle', 'build');
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
    } else if (actionId === 'record') transition('record');
    else if (actionId === 'close-record') transition(state.day === 8 ? 'morning' : 'world');
    else if (actionId === 'end-day') {
      settleState(state); log('settlement', `cash:${state.cash}`); transition('settlement');
    } else if (actionId === 'begin-day8') {
      state.day = 8; state.minutes = 540; transition('morning');
    } else if (actionId === 'restart') restart();
  }

  function toast(message) {
    const element = $('toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 1800);
  }
  function restart() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    state = freshState(); log('start', 'second-loop-01'); commit(); toast('Experiment reset');
  }
  function boot() {
    state = load();
    if (!state.events.length) log('start', 'second-loop-01');
    $('surface').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button && !button.disabled) handle(button.dataset.action, button.dataset.value || '');
    });
    $('reset-button').addEventListener('click', restart);
    render(); save();
  }

  const api = { ASSETS, ECONOMY, COSTS, QUESTIONS, FIXTURES, freshState, chosenLines, deriveAdjacent, approvedSettlement, futureScenarioPool, applyPatch, settleState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.__secondLoopExperiment = { getState: () => state, reset: restart, mechanics: api };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
}());
