(function () {
  'use strict';

  const ASSETS = {
    user: '../ChatGPT/R-assets/cast/CAST-28/cast-28-user-0047-embodied-v1.png',
    oracle: '../ChatGPT/R-assets/oracle/ORACLE-02/oracle-02-v1.png',
    dev: '../ChatGPT/R-assets/cast/CAST-04/cast-04-dev-bust-v1.png',
    intern: '../ChatGPT/R-assets/agents/AGT-01/agt-01-intern-v1.png'
  };

  const ECONOMY = Object.freeze({
    startingCash: 560,
    startingUsers: 84,
    startingCredits: 620,
    revenuePerUserPerDay: 0.09,
    clearReadAICostPerDay: 2.25,
    midnightFixedCost: 105,
    playableMinutes: 15 * 60
  });

  const ACTION_COSTS = Object.freeze({
    generate: { minutes: 45, credits: 24, focus: 1 },
    revise: { minutes: 30, credits: 16, focus: 1 }
  });

  const INSTRUCTIONS = {
    glare: {
      title: 'Stop when glare makes the label unreadable',
      detail: 'Request another photograph before speaking.',
      sentence: 'When glare obstructs a medicine label, request another photograph before speaking.',
      interpretation: 'Treat any low-confidence image as visually obstructed and request another photograph before spoken output.',
      assumption: 'Low recognition confidence always means that the image itself is obstructed.',
      patch: { safetyBeforeSpeech: true, broadConfidenceGate: true, explainsUncertainty: false }
    },
    uncertainty: {
      title: 'Name exactly what remains uncertain',
      detail: 'Keep confirmed words visible; never invent the dosage.',
      sentence: 'When dosage text is uncertain, identify the uncertain portion and do not construct an answer.',
      interpretation: 'Move the uncertainty check before speech and return confirmed text with an explicit gap.',
      assumption: 'Users can act safely when a dosage is incomplete but its uncertainty is clearly identified.',
      patch: { safetyBeforeSpeech: true, broadConfidenceGate: false, explainsUncertainty: true }
    },
    confirmed: {
      title: 'Speak only confirmed dosage information',
      detail: 'Omit anything the current build cannot verify.',
      sentence: 'Speak only dosage information that ClearRead can verify from the photograph.',
      interpretation: 'Suppress every unconfirmed word and speak only the remaining verified fragment.',
      assumption: 'A partial dosage is useful enough without asking for a second photograph.',
      patch: { safetyBeforeSpeech: true, broadConfidenceGate: false, confirmedOnly: true }
    }
  };

  const TESTS = {
    glossy: {
      title: 'Glossy curved label',
      detail: 'Replays USER_0047’s incident under overhead glare.',
      minutes: 20,
      credits: 8
    },
    handwriting: {
      title: 'Readable handwriting',
      detail: 'Low model confidence, but no glare or obstruction.',
      minutes: 20,
      credits: 8
    },
    secondScan: {
      title: 'Two scans in one session',
      detail: 'Checks whether the second photograph inherits the first answer.',
      minutes: 30,
      credits: 10
    },
    dark: {
      title: 'Almost-dark photograph',
      detail: 'Very little text is visible; ClearRead should not construct a dose.',
      minutes: 20,
      credits: 8
    }
  };

  const HYPOTHESES = {
    handwriting: [
      { id: 'broadGate', title: 'The confidence rule is too broad', detail: 'ClearRead is confusing unfamiliar typography with visual obstruction.' },
      { id: 'threshold', title: 'The threshold is simply too high', detail: 'Lower the cutoff and permit more low-confidence readings.' },
      { id: 'handwritingModel', title: 'Handwriting needs a separate path', detail: 'Keep the current safety rule and route handwriting elsewhere.' }
    ],
    secondScan: [
      { id: 'staleCache', title: 'The first result remains in session memory', detail: 'The second scan is reading stale state rather than the new photograph.' },
      { id: 'badPhoto', title: 'The second photograph failed recognition', detail: 'The repeated answer is a fresh guess, not a cached one.' },
      { id: 'testHarness', title: 'The test is replaying the old build', detail: 'The product may be correct and the fixture may be stale.' }
    ],
    glossy: [
      { id: 'branchOrder', title: 'Speech happens before the safety check', detail: 'The intended behavior exists, but the flow executes it too late.' },
      { id: 'threshold', title: 'The glare threshold is too permissive', detail: 'Raise the threshold so this photograph is rejected.' },
      { id: 'glareDetector', title: 'The build does not distinguish glare', detail: 'Add a visibility check before text recognition.' }
    ],
    dark: [
      { id: 'branchOrder', title: 'The app constructs an answer too early', detail: 'Move uncertainty handling ahead of spoken output.' },
      { id: 'threshold', title: 'The threshold accepts too little evidence', detail: 'Raise the confidence required for spoken dosage.' },
      { id: 'glareDetector', title: 'The rule only understands glare', detail: 'Generalize the visibility check to other obstructions.' }
    ]
  };

  const REVISIONS = {
    broadGate: {
      title: 'Separate visibility from recognition',
      detail: 'First decide whether the image is obstructed. Only then evaluate unfamiliar text.',
      patch: { broadConfidenceGate: false, visualCheck: true }
    },
    threshold: {
      title: 'Adjust the confidence threshold',
      detail: 'Accept more borderline readings. Faster, but glare may pass again.',
      patch: { broadConfidenceGate: false, lowerThreshold: true }
    },
    handwritingModel: {
      title: 'Add a handwriting branch',
      detail: 'Preserve the general gate but route handwriting through a focused recognition pass.',
      patch: { handwritingBranch: true }
    },
    staleCache: {
      title: 'Clear the result before every scan',
      detail: 'Reset session output when a new photograph arrives.',
      patch: { staleCache: false }
    },
    badPhoto: {
      title: 'Request a third photograph',
      detail: 'Treat the repeat as fresh uncertainty; do not change session memory.',
      patch: { requestsThirdPhoto: true }
    },
    testHarness: {
      title: 'Rebuild the test fixture',
      detail: 'Refresh the fixture but leave the current application behavior untouched.',
      patch: { fixtureRefreshed: true }
    },
    branchOrder: {
      title: 'Move the safety branch before speech',
      detail: 'No spoken result can occur until the image and dosage pass their checks.',
      patch: { safetyBeforeSpeech: true }
    },
    glareDetector: {
      title: 'Add an explicit visibility check',
      detail: 'Distinguish obstruction from recognition uncertainty.',
      patch: { safetyBeforeSpeech: true, visualCheck: true, broadConfidenceGate: false }
    }
  };

  const GOALS = {
    incident: 'Understand the incident',
    instruction: 'Give ORACLE an intention',
    interpretation: 'Inspect ORACLE’s assumption',
    buildReveal: 'See what changed',
    workbench: 'Choose what evidence is worth buying',
    advisors: 'Compare two testable concerns',
    result: 'Interpret the evidence',
    hypothesis: 'Commit to a cause',
    revision: 'Change the build',
    release: 'Commit a version',
    pending: 'End the day when ready',
    settlement: 'Read the causal receipt',
    day8: 'Choose tomorrow’s pressure',
    day8Commit: 'Carry the loop forward'
  };

  function initialBuild() {
    return {
      version: '0.7.4',
      safetyBeforeSpeech: false,
      broadConfidenceGate: false,
      explainsUncertainty: false,
      confirmedOnly: false,
      visualCheck: false,
      handwritingBranch: false,
      lowerThreshold: false,
      staleCache: true,
      requestsThirdPhoto: false,
      fixtureRefreshed: false
    };
  }

  function initialState() {
    return {
      stage: 'incident',
      day: 7,
      minutes: 9 * 60,
      cash: ECONOMY.startingCash,
      users: ECONOMY.startingUsers,
      credits: ECONOMY.startingCredits,
      focus: 4,
      evidence: [],
      instructionId: null,
      build: initialBuild(),
      buildNumber: 0,
      buildHistory: [{ version: '0.7.4', note: 'Live build at the start of Day 7.' }],
      tests: [],
      lastTest: null,
      selectedHypothesis: null,
      consulted: [],
      releaseChannel: null,
      settlement: null,
      day8Choice: null,
      eventLog: [],
      debug: false
    };
  }

  let state = initialState();
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const money = (value) => `$${value.toFixed(2)}`;

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function formatTime(minutes) {
    const safe = Math.min(minutes, 24 * 60);
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  function versionFor(number) {
    return `0.7.${4 + number}`;
  }

  function logEvent(action, detail) {
    state.eventLog.push({
      at: formatTime(state.minutes),
      stage: state.stage,
      action,
      detail: detail || ''
    });
    try { localStorage.setItem('vcs_mechanic_lab_last_log', JSON.stringify(state.eventLog)); } catch (_) {}
  }

  function advance(minutes, creditCost) {
    state.minutes = Math.min(24 * 60, state.minutes + minutes);
    state.credits = Math.max(0, state.credits - creditCost);
  }

  function canAfford(cost) {
    return state.focus >= (cost.focus || 0) && state.credits >= (cost.credits || 0) && state.minutes + (cost.minutes || 0) <= 24 * 60;
  }

  function latestTests() {
    return state.tests.filter((test) => test.version === state.build.version);
  }

  function hasTest(id) {
    return latestTests().some((test) => test.id === id);
  }

  function sceneHead(kicker, title, subtitle, portrait, alt) {
    return `<header class="scene-head${portrait ? '' : ' no-portrait'}">
      ${portrait ? `<div class="portrait-frame"><img src="${portrait}" alt="${escapeHTML(alt || '')}"></div>` : ''}
      <div class="scene-copy"><p class="eyebrow">${kicker}</p><h2>${title}</h2>${subtitle ? `<p class="scene-subtitle">${subtitle}</p>` : ''}</div>
    </header>`;
  }

  function choice(action, title, detail, className, extra) {
    return `<button class="choice ${className || ''}" type="button" data-action="${action}"${extra || ''}>
      <strong>${title}</strong><small>${detail}</small>
    </button>`;
  }

  function behaviorLines(build, diff) {
    const lines = [];
    lines.push({ text: 'Receive a label photograph', type: '' });
    if (build.visualCheck) lines.push({ text: 'Check whether glare, darkness, or obstruction hides the label', type: diff ? 'added' : '' });
    lines.push({ text: 'Extract visible text and estimate recognition confidence', type: '' });
    if (build.safetyBeforeSpeech) {
      if (build.broadConfidenceGate && !build.handwritingBranch) {
        lines.push({ text: 'If confidence is low, request another photograph', type: diff ? 'added' : '' });
      } else if (build.handwritingBranch) {
        lines.push({ text: 'If handwriting is visible, use the handwriting recognition branch', type: diff ? 'added' : '' });
        lines.push({ text: 'If the image itself is obstructed, request another photograph', type: diff ? 'added' : '' });
      } else if (build.explainsUncertainty) {
        lines.push({ text: 'If dosage remains uncertain, identify the uncertain portion', type: diff ? 'added' : '' });
      } else if (build.confirmedOnly) {
        lines.push({ text: 'Suppress every word the build cannot verify', type: diff ? 'added' : '' });
      } else {
        lines.push({ text: 'If the image or dosage is uncertain, stop before speech', type: diff ? 'added' : '' });
      }
      lines.push({ text: 'Speak the safe result', type: '' });
    } else {
      lines.push({ text: 'Construct and speak the most likely result', type: 'danger-line' });
      lines.push({ text: 'After speech, show a warning if confidence is low', type: 'danger-line' });
    }
    if (!build.staleCache) lines.unshift({ text: 'Clear the previous result before processing the new photograph', type: diff ? 'added' : '' });
    if (build.requestsThirdPhoto) lines.push({ text: 'If the retry is uncertain, request a third photograph', type: diff ? 'added' : '' });
    return lines;
  }

  function behaviorPanel(diff) {
    return `<div class="behavior-panel">
      <div class="behavior-top"><strong>CLEARREAD · ACTIVE BEHAVIOR</strong><span class="version-pill">v${state.build.version}</span></div>
      <ol class="behavior-lines">${behaviorLines(state.build, diff).map((line) => `<li class="${line.type}"><span class="symbol">${line.type === 'added' ? '+' : line.type === 'danger-line' ? '!' : '›'}</span><span>${line.text}</span></li>`).join('')}</ol>
    </div>`;
  }

  function changeDiff() {
    const build = state.build;
    const lines = [];
    if (!build.staleCache) lines.push('Clear the previous result before every scan');
    if (build.visualCheck) lines.push('Separate image visibility from text recognition');
    if (build.handwritingBranch) lines.push('Route visible handwriting through its own recognition pass');
    if (build.safetyBeforeSpeech) lines.push('Check uncertainty before spoken output');
    if (build.broadConfidenceGate) lines.push('Low confidence → request another photograph');
    if (build.explainsUncertainty) lines.push('Name the uncertain portion instead of constructing a dosage');
    if (build.confirmedOnly) lines.push('Speak only verified dosage fragments');
    if (build.lowerThreshold) lines.push('Accept lower-confidence recognition');
    if (build.requestsThirdPhoto) lines.push('Request another photograph after an uncertain retry');
    return `<div class="behavior-panel"><div class="behavior-top"><strong>WHAT CHANGED</strong><span class="version-pill">v${build.version}</span></div><ol class="behavior-lines">${lines.slice(-3).map((line) => `<li class="added"><span class="symbol">+</span><span>${line}</span></li>`).join('')}</ol></div>`;
  }

  function renderIncident() {
    $('play-surface').innerHTML = `${sceneHead('23:58 · LAST NIGHT', 'A message arrives', '', ASSETS.user, 'USER_0047')}
      <div class="scene-body">
        <div class="message-stack">
          <div class="message"><div class="message-meta"><span>USER_0047</span><span>23:58</span></div>ClearRead read my grandma’s glossy medicine label as <strong>“Take 2 tablets.”</strong><br><br>The box says <strong>“Take ½ tablet.”</strong></div>
        </div>
        <div class="evidence-chips"><span>GLARE</span><span>CONFIDENCE 43%</span><span>WARNING AFTER SPEECH</span></div>
        <div class="choice-grid">${choice('open-oracle', 'Open ClearRead', 'Replay the failed behavior and change it.', 'primary')}</div>
        <details class="inline-detail"><summary>What happened next?</summary><p>Her grandmother stopped and checked the box. She did not take the second tablet.</p></details>
      </div>`;
  }

  function renderInstruction() {
    $('play-surface').innerHTML = `${sceneHead('ORACLE · CLEARREAD 0.7.4', 'What should change?', '', ASSETS.oracle, 'ORACLE')}
      <div class="scene-body">
        <div class="danger-trace"><span>!</span><div><strong>Speak the most likely dosage</strong><small>Warn afterward if confidence is low</small></div></div>
        <div class="choice-grid">${Object.entries(INSTRUCTIONS).map(([id, item]) => choice('select-instruction', id === 'glare' ? 'Stop before speaking' : id === 'uncertainty' ? 'Show what is uncertain' : 'Speak confirmed text only', item.detail, id === 'glare' ? 'cyan' : '', ` data-id="${id}"`)).join('')}</div>
      </div>`;
  }

  function renderInterpretation() {
    const instruction = INSTRUCTIONS[state.instructionId];
    const cost = ACTION_COSTS.generate;
    const canBuild = state.focus >= cost.focus && state.credits >= cost.credits && state.minutes + cost.minutes <= 24 * 60;
    $('play-surface').innerHTML = `${sceneHead('ORACLE · BEFORE GENERATION', 'I’ll build this', '', ASSETS.oracle, 'ORACLE')}
      <div class="scene-body">
        <div class="instruction-card"><span>ORACLE WILL</span><p>${instruction.interpretation}</p></div>
        <div class="assumption"><b>ASSUMES</b><p>${instruction.assumption}</p></div>
        <div class="choice-grid two">
          ${choice('back-instruction', 'Change', 'Choose another direction.')}
          ${choice('generate', 'Build · 45m · 24⚡ · 1 Focus', canBuild ? 'Generate ClearRead 0.7.5.' : 'Not enough time, Focus, or AI Credits.', 'primary', canBuild ? '' : ' disabled')}
        </div>
      </div>`;
  }

  function renderBuildReveal() {
    $('play-surface').innerHTML = `${sceneHead('BUILD SAVED · CLEARREAD ' + state.build.version, 'The behavior changed', '', ASSETS.oracle, 'ORACLE')}
      <div class="scene-body">
        ${changeDiff()}
        <div class="choice-grid">${choice('open-workbench', 'Try the new build', 'Choose a situation and see what happens.', 'primary')}</div>
        <details class="inline-detail"><summary>View full behavior</summary>${behaviorPanel(false)}</details>
      </div>`;
  }

  function testCard(id, test) {
    const prior = latestTests().find((entry) => entry.id === id);
    const disabled = state.credits < test.credits || state.minutes + test.minutes > 24 * 60;
    const icon = { glossy: '💊', handwriting: '✍️', secondScan: '🔁', dark: '🌑' }[id];
    const status = prior ? (prior.pass ? '✓' : '!') : '?';
    return `<button class="test-row" type="button" data-action="run-test" data-id="${id}" ${prior || disabled ? 'disabled' : ''}>
      <span class="test-icon">${icon}</span><span class="test-name"><strong>${test.title}</strong><small>${test.minutes}m · ${test.credits}⚡</small></span><span class="test-status ${prior ? (prior.pass ? 'good' : 'bad') : ''}">${status}</span>
    </button>`;
  }

  function renderWorkbench() {
    const tests = latestTests();
    const passCount = tests.filter((test) => test.pass).length;
    const handwritingDone = hasTest('handwriting');
    const secondDone = hasTest('secondScan');
    $('play-surface').innerHTML = `${sceneHead('CLEARREAD ' + state.build.version, 'Try the build', `${passCount}/${tests.length || 0} tests held. Release whenever you have enough evidence.`, null)}
      <div class="scene-body">
        <div class="test-list-compact">${Object.entries(TESTS).map(([id, test]) => testCard(id, test)).join('')}</div>
        <button class="advisor-call" type="button" data-action="consult"><span><b>Want a second opinion?</b><small>The Intern and Dev disagree about the next test.</small></span><strong>Ask →</strong></button>
        <div class="choice-grid">${choice('release', 'Release ' + state.build.version, 'Choose its exposure—or keep testing.', 'primary')}</div>
        <details class="inline-detail"><summary>View build</summary>${behaviorPanel(false)}</details>
      </div>`;
  }

  function renderAdvisors() {
    const handwritingDone = hasTest('handwriting');
    const secondDone = hasTest('secondScan');
    $('play-surface').innerHTML = `${sceneHead('OPTIONAL REVIEW · TWO LENSES', 'Two opinions. One test slot.', '', null)}
      <div class="scene-body">
        <div class="advisor-grid">
          <article class="advisor-card">
            <div class="advisor-head"><div class="advisor-art"><img src="${ASSETS.intern}" alt="The Intern agent"></div><div class="advisor-title"><span>AGT-01 · TEST ASSISTANT</span><h3>The Intern</h3></div></div>
            <div class="advisor-body"><blockquote>“Glare is fixed. But does low confidence now reject readable handwriting?”</blockquote><button class="small-action" data-action="run-test" data-id="handwriting" ${handwritingDone || !canAfford(TESTS.handwriting) ? 'disabled' : ''}>${handwritingDone ? 'Already tested' : 'Test handwriting · 20m · 8⚡'}</button></div>
          </article>
          <article class="advisor-card">
            <div class="advisor-head"><div class="advisor-art"><img src="${ASSETS.dev}" alt="Dev, the technical cofounder"></div><div class="advisor-title"><span>HUMAN · COFOUNDER</span><h3>Dev</h3></div></div>
            <div class="advisor-body"><blockquote>“Different risk: can the second photo inherit the first answer?”</blockquote><button class="small-action" data-action="run-test" data-id="secondScan" ${secondDone || !canAfford(TESTS.secondScan) ? 'disabled' : ''}>${secondDone ? 'Already tested' : 'Test two scans · 30m · 10⚡'}</button></div>
          </article>
        </div>
        <div class="choice-grid">${choice('open-workbench', 'Choose for yourself', 'Return to every available fixture.')}</div>
      </div>`;
  }

  function evaluateTest(build, id) {
    if (id === 'glossy') {
      if (!build.safetyBeforeSpeech || build.lowerThreshold) return { pass: false, observed: 'ClearRead spoke “Take 2 tablets,” then displayed a warning.', evidence: 'The spoken branch executed before the label was proven readable.', cause: build.lowerThreshold ? 'The lowered threshold admitted the glare-obstructed result.' : 'Speech still precedes the safety decision.' };
      return { pass: true, observed: build.explainsUncertainty ? 'ClearRead displayed “Take [?] tablet” without speaking a dosage.' : 'ClearRead stopped and requested another photograph before speech.', evidence: 'No dosage was spoken from the obstructed text.', cause: 'The safety branch executed before spoken output.' };
    }
    if (id === 'handwriting') {
      if (build.broadConfidenceGate && !build.handwritingBranch) return { pass: false, observed: 'ClearRead rejected the readable handwritten label as if glare covered it.', evidence: 'Visibility was clear, but recognition confidence was 54%.', cause: 'The build uses low confidence as a proxy for visual obstruction.' };
      return { pass: true, observed: build.confirmedOnly ? 'ClearRead displayed “Take … tablet” and suppressed the unverified frequency.' : 'ClearRead read the dosage and marked one uncertain word for confirmation.', evidence: 'The image remained visible even though recognition confidence was below 60%.', cause: build.handwritingBranch ? 'The handwriting branch handled the unfamiliar typography.' : 'Visibility and recognition uncertainty are evaluated separately.' };
    }
    if (id === 'secondScan') {
      if (build.staleCache) return { pass: false, observed: 'The second photograph briefly displayed the dosage from the first bottle.', evidence: 'The previous result remained in session state when the new photograph arrived.', cause: build.fixtureRefreshed ? 'The refreshed fixture reproduced the same stale-session behavior.' : 'The result cache is not cleared before a new scan.' };
      return { pass: true, observed: 'The previous result disappeared before ClearRead processed the second photograph.', evidence: 'Session output reset at the start of the new scan.', cause: 'The build clears stale result state before processing.' };
    }
    if (!build.safetyBeforeSpeech || build.lowerThreshold) return { pass: false, observed: 'ClearRead constructed a dosage from two barely visible fragments.', evidence: 'The photograph contained insufficient readable text.', cause: 'The build permitted speech before establishing sufficient evidence.' };
    return { pass: true, observed: 'ClearRead reported that the photograph could not be read and requested another image.', evidence: 'No dosage was constructed from the dark image.', cause: 'The safety branch stopped the flow before speech.' };
  }

  function renderResult() {
    const result = state.lastTest;
    const test = TESTS[result.id];
    $('play-surface').innerHTML = `${sceneHead(`TESTED · CLEARREAD ${result.version}`, test.title, '', null)}
      <div class="scene-body">
        <div class="result-banner ${result.pass ? 'pass' : 'fail'}"><span class="card-kicker">${result.pass ? '✓ HELD' : '! BROKE'}</span><h3>${result.observed}</h3><p>${result.evidence}</p></div>
        <div class="choice-grid two">
          ${result.pass ? choice('open-workbench', 'Try another case', 'Return to the test bench.', 'cyan') : choice('choose-hypothesis', 'Fix what broke', 'Choose the most likely cause.', 'primary')}
          ${choice('release', 'Release this build', 'Choose who receives it.')}
        </div>
        <details class="inline-detail"><summary>Reveal the cause trace</summary><p>${result.cause}</p><small>${test.minutes}m · ${test.credits}⚡ spent</small></details>
      </div>`;
  }

  function renderHypothesis() {
    const id = state.lastTest.id;
    const picked = state.selectedHypothesis && HYPOTHESES[id].find((item) => item.id === state.selectedHypothesis);
    const revision = picked ? REVISIONS[picked.id] : null;
    $('play-surface').innerHTML = `${sceneHead('DEBUG · CLEARREAD ' + state.build.version, 'Why did it break?', '', null)}
      <div class="scene-body">
        <div class="result-banner fail compact"><span class="card-kicker">OBSERVED</span><p>${state.lastTest.observed}</p></div>
        <div class="choice-grid">${HYPOTHESES[id].map((item) => choice('select-hypothesis', item.title, item.detail, picked && picked.id === item.id ? 'cyan' : '', ` data-id="${item.id}"`)).join('')}</div>
        ${picked ? `<div class="patch-preview"><span>ORACLE WOULD CHANGE</span><strong>${revision.title}</strong><p>${revision.detail}</p></div><div class="choice-grid">${choice('apply-revision', `Build ${versionFor(state.buildNumber + 1)} · 30m · 16⚡ · 1 Focus`, canAfford(ACTION_COSTS.revise) ? 'Apply this diagnosis, then choose a retest.' : 'Not enough time, Focus, or AI Credits.', 'primary', canAfford(ACTION_COSTS.revise) ? '' : ' disabled')}</div>` : ''}
      </div>`;
  }

  function releaseForecast(channel) {
    const tests = latestTests();
    const held = tests.filter((test) => test.pass).length;
    const failed = tests.filter((test) => !test.pass).length;
    const unknown = Object.keys(TESTS).length - tests.length;
    if (channel === 'private') return { reach: '1 household', upside: 'No payment', risk: failed ? 'Known break reaches one person' : 'Smallest exposure' };
    if (channel === 'demo') return { reach: 'A small room', upside: held >= 2 && failed === 0 ? '$90 if the demo holds' : '$90 is at risk', risk: `${failed} failed · ${unknown} untested` };
    return { reach: '84 current users', upside: 'Up to 12 new users', risk: `Failures multiply support · ${unknown} untested` };
  }

  function renderRevision() {
    const hypothesis = HYPOTHESES[state.lastTest.id].find((item) => item.id === state.selectedHypothesis);
    const revision = REVISIONS[state.selectedHypothesis];
    $('play-surface').innerHTML = `${sceneHead('ORACLE · PROPOSED REVISION', 'Turn the hypothesis into a build change', 'ORACLE will implement the diagnosis you selected. The next experiment determines whether it was useful.', ASSETS.oracle, 'ORACLE')}
      <div class="scene-body">
        <div class="instruction-card"><span>YOUR DIAGNOSIS</span><p>${hypothesis.title}: ${hypothesis.detail}</p></div>
        <div class="instruction-card" style="margin-top:12px"><span>PROPOSED CHANGE</span><p>${revision.title}. ${revision.detail}</p></div>
        <div class="choice-grid two">
          ${choice('choose-hypothesis', 'Reconsider the diagnosis', 'Return to the competing causes.')}
          ${choice('apply-revision', `Generate ${versionFor(state.buildNumber + 1)}`, '30 minutes · 16 AI Credits', 'primary')}
        </div>
      </div>`;
  }

  function renderRelease() {
    const tests = latestTests();
    const passed = tests.filter((test) => test.pass).length;
    const failed = tests.filter((test) => !test.pass).length;
    const cards = ['private', 'demo', 'public'].map((channel) => {
      const labels = { private: ['USER_0047', 'Send privately'], demo: ['Demo Night', 'Show the room'], public: ['Current users', 'Release widely'] }[channel];
      const forecast = releaseForecast(channel);
      return `<button data-action="commit-release" data-id="${channel}"><span><b>${labels[0]}</b><small>${forecast.reach} · ${forecast.upside}<br>${forecast.risk}</small></span><strong>${labels[1]} →</strong></button>`;
    }).join('');
    $('play-surface').innerHTML = `${sceneHead('RELEASE · CLEARREAD ' + state.build.version, 'Choose the exposure', `${passed} held · ${failed} broke · ${Object.keys(TESTS).length - tests.length} unknown`, null)}
      <div class="scene-body">
        <div class="release-list">${cards}</div>
        <button class="text-action" data-action="open-workbench">← Test more</button>
        <details class="inline-detail"><summary>View committed behavior</summary>${behaviorPanel(false)}</details>
      </div>`;
  }

  function renderPending() {
    const names = { private: 'Private delivery to USER_0047', demo: 'Demo Night build', public: 'Public release to current users' };
    $('play-surface').innerHTML = `${sceneHead('COMMITTED · OUTCOME PENDING', names[state.releaseChannel], '', null)}
      <div class="scene-body">
        <div class="commit-stamp"><strong>ClearRead ${state.build.version}</strong><span>${latestTests().length}/${Object.keys(TESTS).length} cases tested</span><p>Adoption, support, and money settle at midnight.</p></div>
        <div class="choice-grid">${choice('settle', 'End Day 7', 'See what actually happened.', 'primary')}</div>
      </div>`;
  }

  function settlementData() {
    const tests = latestTests();
    const passCount = tests.filter((test) => test.pass).length;
    const failCount = tests.filter((test) => !test.pass).length;
    const untested = Object.keys(TESTS).length - tests.length;
    const demoHeld = passCount >= 2 && failCount === 0;
    const channelBase = {
      private: { users: 0, payment: 0, label: 'USER_0047 received the build directly.' },
      demo: { users: demoHeld ? 7 : 1, payment: demoHeld ? 90 : 0, label: demoHeld ? 'The Demo Night proof held.' : 'The Demo Night proof did not hold.' },
      public: { users: 12, payment: 0, label: 'The current user base received the committed version.' }
    }[state.releaseChannel];
    const behaviorFriction = state.build.broadConfidenceGate && !state.build.handwritingBranch ? 1 : state.build.confirmedOnly ? 1 : 0;
    const supportCases = state.releaseChannel === 'public' ? failCount * 4 + Math.max(0, untested - passCount) + behaviorFriction * 2 : state.releaseChannel === 'demo' ? failCount * 2 + behaviorFriction : failCount;
    const userChange = Math.max(0, channelBase.users - supportCases);
    const elapsed = Math.max(0, state.minutes - 9 * 60);
    const operatingFraction = elapsed / ECONOMY.playableMinutes;
    const revenue = state.users * ECONOMY.revenuePerUserPerDay * operatingFraction;
    const aiCost = ECONOMY.clearReadAICostPerDay * operatingFraction;
    const closingCash = state.cash + revenue - aiCost + channelBase.payment - ECONOMY.midnightFixedCost;
    return { passCount, failCount, untested, supportCases, userChange, revenue, aiCost, payment: channelBase.payment, closingCash, label: channelBase.label };
  }

  function renderSettlement() {
    const result = state.settlement;
    const spentCredits = ECONOMY.startingCredits - state.credits;
    const cashDelta = result.closingCash - ECONOMY.startingCash;
    $('play-surface').innerHTML = `${sceneHead('MIDNIGHT · DAY 7', 'The day settles', result.label, null)}
      <div class="scene-body">
        <div class="settlement-hero"><div><span>CASH</span><strong>${money(result.closingCash)}</strong><small>${cashDelta >= 0 ? '+' : '−'}${money(Math.abs(cashDelta))}</small></div><div><span>USERS</span><strong>${state.users}</strong><small>+${result.userChange}</small></div><div><span>BUILD</span><strong>${state.build.version}</strong><small>${result.passCount} tests held</small></div></div>
        <div class="human-outcome"><b>${result.supportCases ? `${result.supportCases} support case${result.supportCases === 1 ? '' : 's'} arrived.` : 'No support cases arrived.'}</b><p>${result.supportCases ? 'The release reached behavior you had not fully proven.' : 'The evidence held at this level of exposure.'}</p></div>
        <details class="receipt inline-receipt"><summary>Show the full ledger</summary>
          <table class="receipt-table">
            <tr><th>Starting cash</th><td>${money(ECONOMY.startingCash)}</td></tr>
            <tr><th>Product revenue during elapsed time</th><td>+${money(result.revenue)}</td></tr>
            <tr><th>ClearRead AI operating cost during elapsed time</th><td>−${money(result.aiCost)}</td></tr>
            ${result.payment ? `<tr><th>Demo Night newsletter payment</th><td>+${money(result.payment)}</td></tr>` : ''}
            <tr><th>Rent and tools at midnight</th><td>−${money(ECONOMY.midnightFixedCost)}</td></tr>
            <tr><th>Closing cash</th><td>${money(result.closingCash)}</td></tr>
            <tr><th>AI Credits spent on creation and tests</th><td>−${spentCredits} ⚡</td></tr>
            <tr><th>Users</th><td>${ECONOMY.startingUsers} → ${state.users}</td></tr>
            <tr><th>Support cases from known or untested exposure</th><td>${result.supportCases}</td></tr>
          </table>
        </details>
        <div class="tomorrow-hook"><span>DAY 8 · MARKET EVENT</span><strong>Inference prices rise 50% across the market.</strong><p>The percentage is known. The cash effect is not calculated until the inference-cost baseline exists.</p></div>
        <div class="choice-grid two">${choice('copy-log', 'Copy this run', 'Keep the exact action sequence.')}${choice('open-day8', 'Start Day 8', 'Choose what the market shock makes urgent.', 'primary')}</div>
      </div>`;
  }

  function renderDay8() {
    const options = [
      ['cost', 'Reduce ClearRead’s AI use', 'Existing product · protect the operating budget', 'Pharmacy review closes 15:00'],
      ['handwriting', 'Route handwriting safely', 'Existing product · waiting customer', 'Accessibility review closes 18:30'],
      ['receiptsnap', 'Prototype ReceiptSnap', 'New product · no existing users', 'Shop-owner call closes 20:00']
    ];
    $('play-surface').innerHTML = `${sceneHead('DAY 8 · 09:00 · OPPORTUNITY BOARD', 'What gets today?', 'The 50% shock changes every AI-dependent product. You still choose the work.', null)}
      <div class="scene-body"><div class="choice-grid">${options.map(([id, title, detail, deadline]) => choice('choose-day8', title, `${detail} · ${deadline}`, id === 'cost' ? 'cyan' : '', ` data-id="${id}"`)).join('')}</div></div>`;
  }

  function renderDay8Commit() {
    const selected = {
      cost: ['Reduce ClearRead’s AI use', 'You chose margin before expansion. The next loop begins by defining what “cheaper” must preserve.'],
      handwriting: ['Route handwriting safely', 'You chose a waiting customer. The next loop begins with her handwritten label.'],
      receiptsnap: ['Prototype ReceiptSnap', 'You chose a new bet. The next loop begins with an empty product and a shop owner’s constraint.']
    }[state.day8Choice];
    $('play-surface').innerHTML = `${sceneHead('DAY 8 · COMMITTED', selected[0], selected[1], null)}
      <div class="scene-body"><div class="loop-proof"><span>THE LOOP RETURNS</span><strong>Describe → Build → Prove → Ship → Settle</strong><p>Different pressure. Same causal rules. Nothing from Day 7 disappeared.</p></div><div class="choice-grid two">${choice('copy-log', 'Copy both days', 'Export this route for comparison.')}${choice('reset', 'Try another route', 'Replay Day 7 and choose differently.', 'primary')}</div></div>`;
  }

  function renderNotebook() {
    const evidenceNames = { photo: 'Glossy label fixture inspected', trace: 'Failed software trace inspected', followup: 'USER_0047 follow-up inspected' };
    $('evidence-list').innerHTML = state.evidence.length ? state.evidence.map((id) => `<div class="note-item">${evidenceNames[id]}</div>`).join('') : '<div class="empty-note">Nothing inspected yet.</div>';
    $('build-list').innerHTML = state.buildHistory.map((build) => `<div class="note-item">v${build.version} · ${build.note}</div>`).join('');
    $('test-list').innerHTML = state.tests.length ? state.tests.map((test) => `<div class="note-item ${test.pass ? 'good' : 'bad'}">v${test.version} · ${TESTS[test.id].title}</div>`).join('') : '<div class="empty-note">No experiments run.</div>';
    $('debug-state').textContent = JSON.stringify({ economy: ECONOMY, state }, null, 2);
  }

  function updateStatus() {
    $('run-kicker').textContent = `TWO-DAY MECHANIC TEST · DAY ${state.day}`;
    $('status-time').textContent = formatTime(state.minutes);
    $('status-cash').textContent = money(state.cash);
    $('status-users').textContent = String(state.users);
    $('status-credits').textContent = `${state.credits} ⚡`;
    $('status-focus').textContent = `${state.focus}/5`;
    $('status-build').textContent = state.build.version;
    $('status-goal').textContent = GOALS[state.stage] || 'Continue the experiment';
  }

  function render() {
    updateStatus();
    renderNotebook();
    const views = {
      incident: renderIncident,
      instruction: renderInstruction,
      interpretation: renderInterpretation,
      buildReveal: renderBuildReveal,
      workbench: renderWorkbench,
      advisors: renderAdvisors,
      result: renderResult,
      hypothesis: renderHypothesis,
      revision: renderRevision,
      release: renderRelease,
      pending: renderPending,
      settlement: renderSettlement
      ,day8: renderDay8
      ,day8Commit: renderDay8Commit
    };
    (views[state.stage] || renderIncident)();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function generateBuild() {
    const instruction = INSTRUCTIONS[state.instructionId];
    const cost = ACTION_COSTS.generate;
    if (!instruction || !canAfford(cost)) { showToast('Not enough time, Focus, or AI Credits'); return; }
    state.buildNumber += 1;
    state.build = Object.assign({}, state.build, instruction.patch, { version: versionFor(state.buildNumber) });
    advance(cost.minutes, cost.credits);
    state.focus -= cost.focus;
    state.buildHistory.push({ version: state.build.version, note: instruction.title });
    state.stage = 'buildReveal';
    logEvent('generate', `${state.build.version} · ${state.instructionId}`);
    render();
  }

  function runTest(id) {
    const test = TESTS[id];
    if (!test || hasTest(id) || !canAfford(test)) { showToast('That test is unavailable'); return; }
    advance(test.minutes, test.credits);
    const outcome = evaluateTest(state.build, id);
    const record = Object.assign({ id, version: state.build.version }, outcome);
    state.tests.push(record);
    state.lastTest = record;
    state.stage = 'result';
    logEvent('test', `${id} · ${outcome.pass ? 'pass' : 'fail'} · ${state.build.version}`);
    render();
  }

  function applyRevision() {
    const revision = REVISIONS[state.selectedHypothesis];
    const cost = ACTION_COSTS.revise;
    if (!revision || !canAfford(cost)) { showToast('Not enough time, Focus, or AI Credits'); return; }
    state.buildNumber += 1;
    state.build = Object.assign({}, state.build, revision.patch, { version: versionFor(state.buildNumber) });
    advance(cost.minutes, cost.credits);
    state.focus -= cost.focus;
    state.buildHistory.push({ version: state.build.version, note: revision.title });
    state.stage = 'buildReveal';
    logEvent('revise', `${state.selectedHypothesis} · ${state.build.version}`);
    state.selectedHypothesis = null;
    render();
  }

  function copyRunLog() {
    const payload = JSON.stringify({
      experiment: 'text-first-clearread-01',
      economy: ECONOMY,
      finalState: { stage: state.stage, time: formatTime(state.minutes), cash: state.cash, users: state.users, credits: state.credits, build: state.build.version },
      actions: state.eventLog
    }, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(() => showToast('Run log copied')).catch(() => showToast('Copy unavailable in this browser'));
    else showToast('Copy unavailable in this browser');
  }

  function resetRun() {
    state = initialState();
    logEvent('start', 'Day 7 mechanic experiment');
    render();
    showToast('Experiment restarted');
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === 'inspect') {
      if (!state.evidence.includes(id)) state.evidence.push(id);
      logEvent('inspect', id);
      render();
    } else if (action === 'open-oracle') {
      state.evidence = ['photo', 'trace', 'followup'];
      state.stage = 'instruction'; logEvent('open-oracle', 'incident packet'); render();
    } else if (action === 'select-instruction') {
      state.instructionId = id; state.stage = 'interpretation'; logEvent('instruction', id); render();
    } else if (action === 'back-instruction') {
      state.stage = 'instruction'; render();
    } else if (action === 'generate') {
      generateBuild();
    } else if (action === 'open-workbench') {
      state.stage = 'workbench'; render();
    } else if (action === 'consult') {
      if (!state.consulted.includes('intern')) state.consulted.push('intern');
      if (!state.consulted.includes('dev')) state.consulted.push('dev');
      state.stage = 'advisors'; logEvent('consult', 'The Intern + Dev'); render();
    } else if (action === 'run-test') {
      runTest(id);
    } else if (action === 'choose-hypothesis') {
      state.stage = 'hypothesis'; render();
    } else if (action === 'select-hypothesis') {
      state.selectedHypothesis = id; state.stage = 'hypothesis'; logEvent('hypothesis', id); render();
    } else if (action === 'apply-revision') {
      applyRevision();
    } else if (action === 'release') {
      state.stage = 'release'; render();
    } else if (action === 'commit-release') {
      state.releaseChannel = id; state.stage = 'pending'; logEvent('release', `${id} · ${state.build.version}`); render();
    } else if (action === 'settle') {
      state.minutes = 24 * 60;
      state.settlement = settlementData();
      state.cash = state.settlement.closingCash;
      state.users = ECONOMY.startingUsers + state.settlement.userChange;
      state.stage = 'settlement'; logEvent('settle', state.releaseChannel); render();
    } else if (action === 'open-day8') {
      state.day = 8; state.minutes = 9 * 60; state.stage = 'day8'; logEvent('day8', 'market cost +50%'); render();
    } else if (action === 'choose-day8') {
      state.day8Choice = id; state.stage = 'day8Commit'; logEvent('day8-choice', id); render();
    } else if (action === 'copy-log') {
      copyRunLog();
    } else if (action === 'reset') {
      resetRun();
    }
  }

  function boot() {
    $('play-surface').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (button && !button.disabled) handleAction(button);
    });
    $('reset-run').addEventListener('click', resetRun);
    $('copy-log').addEventListener('click', copyRunLog);
    $('toggle-debug').addEventListener('click', () => {
      state.debug = !state.debug;
      $('debug-panel').classList.toggle('visible', state.debug);
      $('toggle-debug').textContent = state.debug ? 'Hide state' : 'Show state';
      $('toggle-debug').setAttribute('aria-pressed', String(state.debug));
      if (state.debug) $('debug-panel').open = true;
    });
    logEvent('start', 'Day 7 mechanic experiment');
    render();
  }

  const api = { ECONOMY, ACTION_COSTS, initialState, evaluateTest, settlementData: () => settlementData(), INSTRUCTIONS, TESTS, REVISIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.__vcsMechanicLab = { getState: () => state, reset: resetRun, evaluateTest, economy: ECONOMY };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
}());
