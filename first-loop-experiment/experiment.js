'use strict';

(function () {
  const ROOT = '..';
  const ASSETS = Object.freeze({
    night: `${ROOT}/ChatGPT/UI-UX/backgrounds/BG-12/bg-12-dark-night-garage-v1.png`,
    garage: `${ROOT}/ChatGPT/R-assets/pixel-drafts/tilesets/Garage/garage-tileset-tier-2-v1.png`,
    user: `${ROOT}/ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png`,
    oracle: `${ROOT}/ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png`,
    founder: `${ROOT}/assets/scenes/characters/CAST-07-dorian/censored/directional/cast-07-dorian-facing-right-v1.png`,
    dev: `${ROOT}/ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png`
  });

  const ECONOMY = Object.freeze({
    openingCash: 560,
    users: 84,
    credits: 620,
    focus: 4,
    revenuePerUserDay: .09,
    aiDaily: 2.25,
    fixedDaily: 105,
    day8Multiplier: 1.5
  });

  const COSTS = Object.freeze({
    build: { minutes: 60, credits: 80, focus: 1 },
    test: { minutes: 30, credits: 20, focus: 0 },
    revise: { minutes: 45, credits: 36, focus: 1 }
  });

  const QUESTIONS = Object.freeze([
    {
      id: 'purpose',
      title: 'What should ClearRead do?',
      options: [
        { id: 'exact', label: 'Read exact dosage', note: 'Only when the line is clear.', line: 'Read the exact dosage when it is visible.' },
        { id: 'fragments', label: 'Read confirmed fragments', note: 'Speak only text it can prove.', line: 'Read only confirmed fragments of the label.' },
        { id: 'decline', label: 'Refuse and explain', note: 'Name why the image cannot be read.', line: 'Refuse unreadable dosage and explain why.' }
      ]
    },
    {
      id: 'condition',
      title: 'When does that rule activate?',
      options: [
        { id: 'glare', label: 'Glare crosses dosage', note: 'Narrow to this incident.', line: 'Activate when glare crosses the dosage line.' },
        { id: 'unreadable', label: 'Key text is unreadable', note: 'Use a broader confidence gate.', line: 'Activate when any critical text is unreadable.' },
        { id: 'medical', label: 'Medicine-label mode', note: 'Protect this product context.', line: 'Activate for uncertain text in medicine-label mode.' }
      ]
    },
    {
      id: 'proof',
      title: 'How will you prove it worked?',
      options: [
        { id: 'retake', label: 'Retake shows full dosage', note: 'Prove recovery end to end.', line: 'A fresh photo produces the complete dosage.' },
        { id: 'silent', label: 'Same photo triggers refusal', note: 'Prove no wrong speech.', line: 'The incident photo produces a clear refusal.' },
        { id: 'review', label: 'Human review confirms label', note: 'Prove with a second reader.', line: 'A reviewer confirms the dosage before speech.' }
      ]
    },
    {
      id: 'guardrail',
      title: 'What must it never do?',
      options: [
        { id: 'noGuess', label: 'Speak uncertain dosage', note: 'Block an unproven result.', line: 'Never speak an uncertain dosage.' },
        { id: 'freshScan', label: 'Reuse an old scan', note: 'Keep each attempt separate.', line: 'Never reuse a previous scan for a retake.' },
        { id: 'consent', label: 'Send without consent', note: 'Keep human review opt-in.', line: 'Never send a label without user consent.' }
      ]
    }
  ]);

  const FIXTURES = Object.freeze({
    stale: {
      id: 'stale', title: 'Second-photo session', observed: 'The retake reused the first scan.',
      cause: 'Recovery changed, but scan memory did not.', target: 'guardrail',
      diagnoses: [
        ['memory', 'Old scan survived', 'The retake did not start a fresh session.'],
        ['camera', 'Camera stayed blurred', 'The new image may still be unclear.']
      ],
      patches: [
        ['support', 'Clear scan memory', 'Start every retake from a fresh scan.', 'Start each retake from a fresh scan.'],
        ['decline', 'Decline mixed sessions', 'Refuse when scan identity is uncertain.', 'Decline when a retake contains mixed scan state.']
      ]
    },
    handwriting: {
      id: 'handwriting', title: 'Readable handwriting', observed: 'The broad gate rejected a readable note.',
      cause: 'Unreadable print and readable handwriting shared one gate.', target: 'condition',
      diagnoses: [
        ['branch', 'No handwriting branch', 'Different evidence entered one condition.'],
        ['threshold', 'Threshold too high', 'The gate may be over-sensitive.']
      ],
      patches: [
        ['support', 'Separate handwriting', 'Route readable handwriting independently.', 'Use a separate evidence check for handwriting.'],
        ['decline', 'Name the supported input', 'Decline handwriting outside this release.', 'Apply this build to printed labels only.']
      ]
    },
    consent: {
      id: 'consent', title: 'After-hours review', observed: 'The photo entered a review queue automatically.',
      cause: 'Human review was added without a consent boundary.', target: 'guardrail',
      diagnoses: [
        ['consent', 'Consent was missing', 'The user never chose to share the image.'],
        ['hours', 'Reviewer was offline', 'The route also needs an availability rule.']
      ],
      patches: [
        ['support', 'Ask before review', 'Make sharing an explicit user choice.', 'Request consent before human review.'],
        ['decline', 'Decline after hours', 'Keep the photo local when review is closed.', 'Decline locally when review is unavailable.']
      ]
    },
    fragments: {
      id: 'fragments', title: 'Split dosage line', observed: 'Confirmed fragments formed an incomplete dose.',
      cause: 'Each fragment was certain; their combination was not.', target: 'purpose',
      diagnoses: [
        ['assembly', 'Fragments were combined', 'Certainty did not survive composition.'],
        ['unit', 'The unit was missing', 'A number alone is not a dosage.']
      ],
      patches: [
        ['support', 'Require a complete field', 'Speak dosage only with number and unit.', 'Read a dosage only when its full field is confirmed.'],
        ['decline', 'Keep fragments visual', 'Show fragments without speaking a dose.', 'Display fragments, but do not speak a partial dosage.']
      ]
    },
    overtrigger: {
      id: 'overtrigger', title: 'Non-medical poster', observed: 'Medicine safeguards activated outside ClearRead.',
      cause: 'The product context was not preserved.', target: 'condition',
      diagnoses: [
        ['context', 'Mode leaked outward', 'The rule needs a product boundary.'],
        ['intent', 'Intent was inferred', 'The app guessed the user context.']
      ],
      patches: [
        ['support', 'Bind the product mode', 'Run the rule only inside ClearRead.', 'Apply the rule only inside ClearRead medicine mode.'],
        ['decline', 'Require explicit mode', 'Ask the user to enter medicine mode.', 'Require an explicit medicine-label mode.']
      ]
    },
    clean: {
      id: 'clean', title: 'Low-light dosage', observed: 'The build declined without inventing text.',
      cause: 'The saved brief already defines this boundary.', target: null,
      diagnoses: [], patches: []
    }
  });

  const STEPS = ['define', 'build', 'incident', 'boundary', 'revise', 'release', 'settle'];
  const now = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const money = value => `$${value.toFixed(2)}`;
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  function freshState() {
    return {
      stage: 'question', question: 0, answers: {}, effectiveLines: {},
      day: 7, minutes: 540, cash: ECONOMY.openingCash, users: ECONOMY.users,
      credits: ECONOMY.credits, focus: ECONOMY.focus, buildVersion: null,
      incidentTested: false, fixture: null, fixturePass: null, diagnosis: null,
      patch: null, releaseScope: null, settled: false, taps: 0,
      startedAt: now(), stageStartedAt: now(), events: [], maxWords: 0
    };
  }

  let state = freshState();
  let toastTimer = null;

  function option(questionId, answerId) {
    const question = QUESTIONS.find(item => item.id === questionId);
    return question && question.options.find(item => item.id === answerId);
  }

  function chosenLines(answers, effectiveLines = {}) {
    return QUESTIONS.map(question => effectiveLines[question.id] || option(question.id, answers[question.id])?.line).filter(Boolean);
  }

  function evaluateIncident(answers) {
    const complete = QUESTIONS.every(question => option(question.id, answers[question.id]));
    return {
      pass: complete,
      observed: answers.purpose === 'decline' ? 'ClearRead refused and explained the glare.' : answers.proof === 'review' ? 'ClearRead held speech for a reviewer.' : answers.purpose === 'fragments' ? 'ClearRead spoke only confirmed text.' : 'ClearRead withheld the hidden dosage.'
    };
  }

  function deriveAdjacent(answers) {
    if (answers.proof === 'retake' && answers.guardrail !== 'freshScan') return FIXTURES.stale;
    if (answers.condition === 'unreadable' && answers.purpose !== 'decline') return FIXTURES.handwriting;
    if (answers.proof === 'review' && answers.guardrail !== 'consent') return FIXTURES.consent;
    if (answers.purpose === 'fragments' && answers.guardrail !== 'noGuess') return FIXTURES.fragments;
    if (answers.condition === 'medical' && answers.guardrail === 'freshScan') return FIXTURES.overtrigger;
    return FIXTURES.clean;
  }

  function applyPatch(lines, fixture, patchId) {
    const patch = fixture.patches.find(item => item[0] === patchId);
    if (!patch) return null;
    return { target: fixture.target, title: patch[1], detail: patch[2], line: patch[3], lines: Object.assign({}, lines, { [fixture.target]: patch[3] }) };
  }

  function approvedSettlement() {
    const revenue = ECONOMY.users * ECONOMY.revenuePerUserDay;
    return {
      opening: ECONOMY.openingCash,
      revenue,
      aiCost: ECONOMY.aiDaily,
      fixed: ECONOMY.fixedDaily,
      closing: roundMoney(ECONOMY.openingCash + revenue - ECONOMY.aiDaily - ECONOMY.fixedDaily),
      users: ECONOMY.users,
      day8AI: roundMoney(ECONOMY.aiDaily * ECONOMY.day8Multiplier)
    };
  }

  function expectedTapCount(needsRevision) { return needsRevision ? 12 : 10; }
  function wordCount(value) { return String(value).trim().split(/\s+/).filter(Boolean).length; }
  function clock(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
  function $(id) { return document.getElementById(id); }

  function log(type, detail = '') {
    state.events.push({ type, detail, stage: state.stage, tap: state.taps, elapsedMs: Math.round(now() - state.startedAt) });
    saveRun();
  }

  function saveRun() {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem('vcs_first_loop_last_run', JSON.stringify(runSummary())); } catch (_) {}
  }

  function runSummary() {
    return {
      experiment: 'first-loop-01', completed: state.settled, taps: state.taps,
      expectedTaps: expectedTapCount(Boolean(state.patch)), maxVisibleWords: state.maxWords,
      answers: state.answers, fixture: state.fixture?.id || null, fixturePass: state.fixturePass,
      diagnosis: state.diagnosis, patch: state.patch?.title || null,
      releaseScope: state.releaseScope, finalCash: state.cash, users: state.users,
      events: state.events
    };
  }

  function setScene(background, portrait, alt, position = 'center') {
    $('scene-art').style.backgroundImage = `url("${background}")`;
    $('scene-art').style.backgroundPosition = position;
    $('scene-art').setAttribute('aria-label', alt || '');
    const image = $('portrait');
    if (portrait) { image.src = portrait; image.alt = alt || ''; image.hidden = false; }
    else { image.hidden = true; image.removeAttribute('src'); image.alt = ''; }
  }

  function choice(action, label, note, id = '', primary = false) {
    return `<button type="button" class="choice${primary ? ' primary' : ''}" data-action="${action}"${id ? ` data-id="${id}"` : ''}><strong>${escapeHTML(label)}</strong><small>${escapeHTML(note)}</small></button>`;
  }

  function stageStep() {
    if (state.stage === 'question') return 0;
    if (state.stage === 'brief') return 1;
    if (state.stage === 'build') return 2;
    if (state.stage === 'incidentResult') return 3;
    if (['adjacentResult', 'diagnose'].includes(state.stage)) return 3;
    if (['patch', 'revised'].includes(state.stage)) return 4;
    if (['release', 'pending'].includes(state.stage)) return 5;
    return 6;
  }

  function renderProgress() {
    const current = stageStep();
    $('progress').innerHTML = STEPS.map((_, index) => `<span class="${index < current ? 'done' : index === current ? 'current' : ''}"></span>`).join('');
  }

  function renderQuestion() {
    const question = QUESTIONS[state.question];
    setScene(state.question === 0 ? ASSETS.night : ASSETS.garage, state.question === 0 ? ASSETS.user : ASSETS.oracle, state.question === 0 ? 'USER_0047' : 'ORACLE', state.question === 0 ? 'center' : '35% center');
    const incident = state.question === 0 ? `<div class="messages"><div class="message"><b>USER_0047</b> · ClearRead spoke the wrong dose from a glossy label.</div><div class="message">The box says half. Grandma almost took two.</div></div>` : '';
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">${state.question === 0 ? '23:58 · INCIDENT' : `ORACLE · QUESTION ${state.question + 1} OF 4`}</p><h1>${escapeHTML(question.title)}</h1>${incident}<div class="choices">${question.options.map((item, index) => choice('answer', item.label, item.note, item.id, state.question === 0 && index === 0)).join('')}</div></div>`;
  }

  function briefMarkup(changedTarget = '') {
    return `<div class="brief"><div class="brief-head"><span>SAVED BEHAVIOR</span><span class="version">${state.buildVersion || 'DRAFT'}</span></div><ol class="behavior-lines">${chosenLines(state.answers, state.effectiveLines).map((line, index) => `<li class="${QUESTIONS[index].id === changedTarget ? 'changed' : ''}">${escapeHTML(line)}</li>`).join('')}</ol></div>`;
  }

  function renderBrief() {
    setScene(ASSETS.garage, ASSETS.oracle, 'ORACLE', '35% center');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">ORACLE · EXACT READBACK</p><h1>This is what I’ll build.</h1>${briefMarkup()}<p class="cost-line">60 minutes · 80⚡ · 1 Focus</p><div class="choices">${choice('build', 'Generate and save', 'Create ClearRead 0.7.5.', '', true)}</div></div>`;
  }

  function renderBuild() {
    setScene(ASSETS.garage, ASSETS.founder, 'The Founder', 'center');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">BUILD SAVED · ${state.buildVersion}</p><h1>Your words became software.</h1><p class="lede">The build remembers the exact four lines. Now replay the photograph that failed.</p>${briefMarkup()}<div class="choices">${choice('test-incident', 'Replay reported photo', '30 minutes · 20⚡', '', true)}</div></div>`;
  }

  function resultMarkup(pass, title, observed) {
    return `<div class="result ${pass ? 'pass' : 'fail'}"><div class="result-mark"><span>${pass ? '✓' : '×'}</span><div><strong>${escapeHTML(title)}</strong><small>${escapeHTML(observed)}</small></div></div></div>`;
  }

  function renderIncidentResult() {
    const result = evaluateIncident(state.answers);
    setScene(ASSETS.night, ASSETS.user, 'USER_0047');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">EVIDENCE · REPORTED PHOTO</p><h1>The incident closes.</h1>${resultMarkup(result.pass, 'Glossy dosage line', result.observed)}<p class="lede">One fixture proves one boundary. Probe the nearest case your brief did not establish.</p><div class="choices">${choice('test-adjacent', 'Probe adjacent case', '30 minutes · 20⚡', '', true)}</div></div>`;
  }

  function renderAdjacentResult() {
    const fixture = state.fixture;
    setScene(ASSETS.garage, ASSETS.dev, 'Dev', 'center');
    if (state.fixturePass) {
      $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">EVIDENCE · ADJACENT FIXTURE</p><h1>The boundary holds.</h1>${resultMarkup(true, fixture.title, fixture.observed)}<div class="dev-line"><img src="${ASSETS.dev}" alt="Dev"><p><b>Dev:</b> “Two fixtures. Same saved brief. No hidden score.”</p></div><div class="choices">${choice('open-release', 'Record a release', 'Choose evidence scope.', '', true)}</div></div>`;
      return;
    }
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">EVIDENCE · ADJACENT FIXTURE</p><h1>A boundary breaks.</h1>${resultMarkup(false, fixture.title, fixture.observed)}<div class="cause"><b>Trace:</b> ${escapeHTML(fixture.cause)}</div><div class="dev-line"><img src="${ASSETS.dev}" alt="Dev"><p><b>Dev:</b> “The build followed the brief. Diagnose the missing boundary.”</p></div><div class="choices">${fixture.diagnoses.map(item => choice('diagnose', item[1], item[2], item[0])).join('')}</div></div>`;
  }

  function renderPatch() {
    const fixture = state.fixture;
    const diagnosis = fixture.diagnoses.find(item => item[0] === state.diagnosis);
    setScene(ASSETS.garage, ASSETS.oracle, 'ORACLE', '35% center');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">ORACLE · FOCUSED REVISION</p><h1>Change one boundary.</h1><p class="lede">Diagnosis: ${escapeHTML(diagnosis[1])}. The other three behavior lines stay saved.</p><div class="choices">${fixture.patches.map(item => choice('apply-patch', item[1], item[2], item[0], item[0] === 'support')).join('')}</div></div>`;
  }

  function renderRevised() {
    setScene(ASSETS.garage, ASSETS.oracle, 'ORACLE', '35% center');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">RETESTED · ${state.buildVersion}</p><h1>Red becomes green.</h1>${resultMarkup(true, state.fixture.title, state.patch.line)}<div class="diff"><span class="diff-label">ONE-LINE PATCH</span><div class="red-green"><div>${escapeHTML(option(state.patch.target, state.answers[state.patch.target]).line)}</div><span>→</span><div>${escapeHTML(state.patch.line)}</div></div></div>${briefMarkup(state.patch.target)}<div class="choices">${choice('open-release', 'Record a release', 'Choose evidence scope.', '', true)}</div></div>`;
  }

  function renderRelease() {
    setScene(ASSETS.garage, ASSETS.founder, 'The Founder', 'center');
    const fixtureName = state.fixture.title;
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">RELEASE · ${state.buildVersion}</p><h1>How far does proof travel?</h1><div class="scope-facts"><span>PROVED · glossy label</span><span>PROVED · ${escapeHTML(fixtureName)}</span><span>UNKNOWN · other languages</span></div><div class="choices">${choice('release', 'Evidence-matched release', 'Only the conditions proved here.', 'evidence', true)}${choice('release', 'Wider-market intent', 'Unknown cases remain recorded.', 'wide')}</div></div>`;
  }

  function renderPending() {
    setScene(ASSETS.garage, ASSETS.founder, 'The Founder', 'center');
    const label = state.releaseScope === 'evidence' ? 'Evidence-matched release' : 'Wider-market intent';
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">RELEASE RECORDED · OUTCOME PENDING</p><h1>The market has not answered.</h1><div class="release-record"><strong>${escapeHTML(label)} · ${state.buildVersion}</strong><span>${clock(state.minutes)} · ${state.fixturePass || state.patch ? '2/2' : '1/2'} fixtures held</span><p>Cash and users remain unchanged. Results belong to a later approved model.</p></div><div class="choices">${choice('settle', 'Close Day 7', 'Settle only approved accounts.', '', true)}</div></div>`;
  }

  function renderSettlement() {
    const ledger = approvedSettlement();
    setScene(ASSETS.night, ASSETS.founder, 'The Founder', 'center');
    $('decision-panel').innerHTML = `<div class="copy-zone"><p class="eyebrow">MIDNIGHT · DAY 7 COMPLETE</p><h1>Every number reconciles.</h1><div class="ledger"><div class="ledger-row"><span>Opening cash</span><b>${money(ledger.opening)}</b></div><div class="ledger-row"><span>84 users × $0.09</span><b>+${money(ledger.revenue)}</b></div><div class="ledger-row"><span>AI operations</span><b>−${money(ledger.aiCost)}</b></div><div class="ledger-row"><span>Rent and tools</span><b>−${money(ledger.fixed)}</b></div><div class="ledger-row total"><span>Closing cash</span><b>${money(ledger.closing)}</b></div></div><div class="day8"><span>DAY 8 · MARKET NOTICE</span><strong>Inference cost multiplier: 1.0× → 1.5×</strong><small>${money(ledger.aiCost)}/day becomes ${money(ledger.day8AI)}/day.</small></div><div class="choices">${choice('copy-run', 'Copy this run', `${state.taps} taps · ${state.patch ? 'revised route' : 'clean route'}`)}${choice('restart', 'Try another strategy', 'The same choices replay deterministically.')}</div></div>`;
  }

  function render() {
    $('status-day').textContent = `DAY ${state.day}`;
    $('status-time').textContent = clock(state.minutes);
    $('status-cash').textContent = money(state.cash).replace('.00', '');
    $('status-credits').textContent = `${state.credits}⚡`;
    $('status-focus').textContent = `${state.focus}/5 Focus`;
    renderProgress();
    const views = {
      question: renderQuestion, brief: renderBrief, build: renderBuild,
      incidentResult: renderIncidentResult, adjacentResult: renderAdjacentResult,
      patch: renderPatch, revised: renderRevised, release: renderRelease,
      pending: renderPending, settlement: renderSettlement
    };
    (views[state.stage] || renderQuestion)();
    const panel = $('decision-panel');
    panel.scrollTop = 0;
    const words = wordCount(panel.querySelector('.copy-zone')?.innerText || panel.innerText);
    state.maxWords = Math.max(state.maxWords, words);
    $('screen-metric').textContent = `Tap ${state.taps} · ${words} words`;
    saveRun();
  }

  function spend(cost) {
    state.minutes += cost.minutes;
    state.credits -= cost.credits;
    state.focus -= cost.focus;
  }

  function transition(stage, detail) {
    state.stage = stage;
    state.stageStartedAt = now();
    log('stage', detail || stage);
    render();
  }

  function settle() {
    if (!state.settled) {
      const ledger = approvedSettlement();
      state.cash = ledger.closing;
      state.users = ledger.users;
      state.minutes = 1440;
      state.settled = true;
      log('settlement', `cash ${ledger.closing} · users ${ledger.users}`);
    }
    transition('settlement');
  }

  function handle(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (!['copy-run', 'restart'].includes(action)) state.taps += 1;
    if (action === 'answer') {
      const question = QUESTIONS[state.question];
      state.answers[question.id] = id;
      state.effectiveLines[question.id] = option(question.id, id).line;
      log('answer', `${question.id}:${id}`);
      if (state.question < QUESTIONS.length - 1) { state.question += 1; transition('question', `question-${state.question + 1}`); }
      else transition('brief');
    } else if (action === 'build') {
      spend(COSTS.build); state.buildVersion = '0.7.5'; log('build', state.buildVersion); transition('build');
    } else if (action === 'test-incident') {
      spend(COSTS.test); state.incidentTested = true; log('test', 'glossy:pass'); transition('incidentResult');
    } else if (action === 'test-adjacent') {
      spend(COSTS.test); state.fixture = deriveAdjacent(state.answers); state.fixturePass = state.fixture.id === 'clean'; log('test', `${state.fixture.id}:${state.fixturePass ? 'pass' : 'fail'}`); transition('adjacentResult');
    } else if (action === 'diagnose') {
      state.diagnosis = id; log('diagnosis', `${state.fixture.id}:${id}`); transition('patch');
    } else if (action === 'apply-patch') {
      const result = applyPatch(state.effectiveLines, state.fixture, id);
      state.patch = result; state.effectiveLines = result.lines; state.buildVersion = '0.7.6'; spend(COSTS.revise); spend(COSTS.test); state.fixturePass = true; log('patch', `${state.fixture.id}:${id}`); log('retest', `${state.fixture.id}:pass`); transition('revised');
    } else if (action === 'open-release') {
      transition('release');
    } else if (action === 'release') {
      state.releaseScope = id; log('release', `${id}:${state.buildVersion}`); transition('pending');
    } else if (action === 'settle') {
      settle();
    } else if (action === 'copy-run') {
      copyRun();
    } else if (action === 'restart') {
      restart();
    }
  }

  function toast(message) {
    const element = $('toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 1700);
  }

  function copyRun() {
    const payload = JSON.stringify(runSummary(), null, 2);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(payload).then(() => toast('Run copied')).catch(() => toast('Copy unavailable'));
    else toast('Copy unavailable');
  }

  function restart() {
    state = freshState(); log('start', 'first-loop-01'); render(); toast('New deterministic run');
  }

  function boot() {
    $('stage').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button && !button.disabled) handle(button);
    });
    $('copy-run').addEventListener('click', copyRun);
    $('restart-run').addEventListener('click', restart);
    $('exit-link').addEventListener('click', () => log('exit', state.settled ? 'after-completion' : `abandon:${state.stage}`));
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveRun());
    log('start', 'first-loop-01'); render();
  }

  const api = { ASSETS, ECONOMY, COSTS, QUESTIONS, FIXTURES, freshState, chosenLines, evaluateIncident, deriveAdjacent, applyPatch, approvedSettlement, expectedTapCount, wordCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.__firstLoopExperiment = { getState: () => state, runSummary, restart, mechanics: api };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
}());
