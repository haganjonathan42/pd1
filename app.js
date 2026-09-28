(function () {
  "use strict";

  var QUESTIONS = (window.QUESTIONS || []).filter(function (q) {
    return q && q.options && q.options.length && q.correct && q.correct.length;
  });

  var EXAMS = Array.from(new Set(QUESTIONS.map(function (q) { return q.exam; }))).sort();

  // ---------- Tabs ----------
  var tabButtons = document.querySelectorAll(".tab-btn");
  var tabPanels = {
    study: document.getElementById("study-tab"),
    quiz: document.getElementById("quiz-tab")
  };
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      Object.keys(tabPanels).forEach(function (k) { tabPanels[k].classList.remove("active"); });
      tabPanels[btn.dataset.tab].classList.add("active");
    });
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function populateExamFilter(sel) {
    EXAMS.forEach(function (ex) {
      var opt = document.createElement("option");
      opt.value = ex;
      opt.textContent = ex;
      sel.appendChild(opt);
    });
  }

  // ---------- Marked-for-review (difficult questions) ----------
  var MARKED_KEY = "pd1_marked_v1";
  var markedIds = loadMarked();

  function loadMarked() {
    try {
      var raw = localStorage.getItem(MARKED_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function saveMarked() {
    try { localStorage.setItem(MARKED_KEY, JSON.stringify(markedIds)); } catch (e) { /* ignore */ }
  }

  function isMarked(qid) { return !!markedIds[qid]; }

  function toggleMarked(qid) {
    if (markedIds[qid]) delete markedIds[qid];
    else markedIds[qid] = true;
    saveMarked();
    updateMarkedCounts();
  }

  function markedCount() { return Object.keys(markedIds).length; }

  var studyMarkedCountEl = document.getElementById("study-marked-count");
  var quizMarkedCountEl = document.getElementById("quiz-marked-count");
  function updateMarkedCounts() {
    var n = markedCount();
    if (studyMarkedCountEl) studyMarkedCountEl.textContent = n;
    if (quizMarkedCountEl) quizMarkedCountEl.textContent = n;
  }

  function markBtnHtml(qid) {
    var marked = isMarked(qid);
    return '<button class="mark-btn' + (marked ? ' marked' : '') + '" type="button" data-mark-qid="' + qid + '" title="Mark for review" aria-label="Mark for review">' +
      (marked ? '★' : '☆') + '</button>';
  }

  // ================= STUDY TAB =================
  var studyList = document.getElementById("study-list");
  var searchInput = document.getElementById("search-input");
  var examFilter = document.getElementById("exam-filter");
  var studyCount = document.getElementById("study-count");
  var studyReviewOnly = document.getElementById("study-review-only");
  populateExamFilter(examFilter);
  updateMarkedCounts();

  var studyWhy = {}; // qid -> bool, persists while app is open

  function renderStudyList() {
    var term = searchInput.value.trim().toLowerCase();
    var exam = examFilter.value;
    var reviewOnly = studyReviewOnly.checked;
    var filtered = QUESTIONS.filter(function (q) {
      if (reviewOnly && !isMarked(q.id)) return false;
      if (exam && q.exam !== exam) return false;
      if (!term) return true;
      var hay = (q.stem + " " + (q.bullets || []).join(" ") + " " +
        q.options.map(function (o) { return o.text; }).join(" ")).toLowerCase();
      return hay.indexOf(term) !== -1;
    });

    studyCount.textContent = filtered.length + " question" + (filtered.length === 1 ? "" : "s");

    if (!filtered.length) {
      studyList.innerHTML = '<div class="empty-state">No questions match.</div>';
      return;
    }

    var html = filtered.map(function (q) {
      var optionsHtml = q.options.map(function (o) {
        var isCorrect = q.correct.indexOf(o.letter) !== -1;
        return '<div class="q-option' + (isCorrect ? ' correct-answer' : '') + '">' +
          '<span class="opt-letter">' + o.letter + '.</span>' +
          '<span>' + escapeHtml(o.text) + '</span>' +
          (isCorrect ? '<span class="opt-check">&check;</span>' : '') +
          '</div>';
      }).join("");

      var bulletsHtml = (q.bullets && q.bullets.length)
        ? '<ul class="q-bullets">' + q.bullets.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join("") + '</ul>'
        : '';

      var codeHtml = q.code ? '<pre class="q-code">' + escapeHtml(q.code) + '</pre>' : '';

      var chooseHint = q.type === 'multi' ? '<div class="q-choose-hint">Choose ' + q.choose + ' answer' + (q.choose > 1 ? 's' : '') + '</div>' : '';

      var flagHtml = q.flagged ? '<span class="badge-flag">Answer corrected</span>' : '';

      var showWhy = !!studyWhy[q.id];
      var whyHtml = q.explanation
        ? '<button class="btn-secondary why-toggle" type="button" data-qid="' + q.id + '">' + (showWhy ? "Hide why" : "Why?") + '</button>' +
          (showWhy ? '<div class="q-explanation"><strong>Why:</strong> ' + escapeHtml(q.explanation) + '</div>' : '')
        : '';

      return '<div class="q-card">' +
        '<div class="q-meta">' +
          '<span class="badge">' + escapeHtml(q.exam) + '</span>' +
          '<span class="badge-num">Q' + q.number + '</span>' +
          flagHtml +
          markBtnHtml(q.id) +
        '</div>' +
        '<p class="q-stem">' + escapeHtml(q.stem) + '</p>' +
        bulletsHtml + codeHtml + chooseHint +
        '<div class="q-options">' + optionsHtml + '</div>' +
        whyHtml +
        '</div>';
    }).join("");

    studyList.innerHTML = html;
  }

  studyList.addEventListener("click", function (e) {
    var whyBtn = e.target.closest(".why-toggle");
    if (whyBtn) {
      var qid = Number(whyBtn.dataset.qid);
      studyWhy[qid] = !studyWhy[qid];
      renderStudyList();
      return;
    }
    var markBtn = e.target.closest(".mark-btn");
    if (markBtn) {
      toggleMarked(Number(markBtn.dataset.markQid));
      renderStudyList();
    }
  });

  studyReviewOnly.addEventListener("change", renderStudyList);

  searchInput.addEventListener("input", renderStudyList);
  examFilter.addEventListener("change", renderStudyList);
  renderStudyList();

  // ================= QUIZ TAB =================
  var quizExamFilter = document.getElementById("quiz-exam-filter");
  populateExamFilter(quizExamFilter);

  var STORAGE_KEY = "pd1_quiz_state_v1";

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var state = loadState();

  function defaultState() {
    return {
      order: QUESTIONS.map(function (q) { return q.id; }),
      index: 0,
      exam: "",
      reviewOnly: false,
      selected: {},      // qid -> array of letters
      answered: {},       // qid -> true
      correctCount: 0,
      attemptedCount: 0,
      showWhy: {}          // qid -> bool
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed.order || !parsed.order.length) return defaultState();
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function currentOrderList() {
    return state.order.filter(function (id) {
      if (state.exam) {
        var q = questionById(id);
        if (!q || q.exam !== state.exam) return false;
      }
      if (state.reviewOnly && !isMarked(id)) return false;
      return true;
    });
  }

  var questionMap = {};
  QUESTIONS.forEach(function (q) { questionMap[q.id] = q; });
  function questionById(id) { return questionMap[id]; }

  var quizCard = document.getElementById("quiz-card");
  var scoreCorrectEl = document.getElementById("score-correct");
  var scoreTotalEl = document.getElementById("score-total");
  var progressFill = document.getElementById("progress-fill");
  var progressText = document.getElementById("progress-text");
  var btnPrev = document.getElementById("quiz-prev");
  var btnNext = document.getElementById("quiz-next");
  var btnSubmit = document.getElementById("quiz-submit");
  var btnShuffle = document.getElementById("quiz-shuffle");
  var btnReset = document.getElementById("quiz-reset");
  var quizReviewOnly = document.getElementById("quiz-review-only");

  quizExamFilter.value = state.exam || "";
  quizReviewOnly.checked = !!state.reviewOnly;
  updateMarkedCounts();

  quizExamFilter.addEventListener("change", function () {
    state.exam = quizExamFilter.value;
    state.index = 0;
    saveState();
    renderQuiz();
  });

  quizReviewOnly.addEventListener("change", function () {
    state.reviewOnly = quizReviewOnly.checked;
    state.index = 0;
    saveState();
    renderQuiz();
  });

  btnShuffle.addEventListener("click", function () {
    state.order = shuffle(state.order);
    state.index = 0;
    saveState();
    renderQuiz();
  });

  btnReset.addEventListener("click", function () {
    if (!confirm("Reset quiz progress and score?")) return;
    state = defaultState();
    quizExamFilter.value = "";
    quizReviewOnly.checked = false;
    saveState();
    renderQuiz();
  });

  btnPrev.addEventListener("click", function () {
    var list = currentOrderList();
    state.index = Math.max(0, state.index - 1);
    saveState();
    renderQuiz();
  });

  btnNext.addEventListener("click", function () {
    var list = currentOrderList();
    state.index = Math.min(list.length - 1, state.index + 1);
    saveState();
    renderQuiz();
  });

  btnSubmit.addEventListener("click", function () {
    var list = currentOrderList();
    var qid = list[state.index];
    var q = questionById(qid);
    if (!q) return;
    if (state.answered[qid]) return;
    var sel = state.selected[qid] || [];
    if (!sel.length) return;
    state.answered[qid] = true;
    state.attemptedCount++;
    var isCorrect = arraysEqualAsSets(sel, q.correct);
    if (isCorrect) state.correctCount++;
    saveState();
    renderQuiz();
  });

  function arraysEqualAsSets(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  function toggleOption(qid, letter, q) {
    if (state.answered[qid]) return;
    var sel = state.selected[qid] || [];
    if (q.type === "single") {
      sel = [letter];
    } else {
      var idx = sel.indexOf(letter);
      if (idx === -1) {
        if (sel.length >= q.choose) return; // cap at required count
        sel = sel.concat([letter]);
      } else {
        sel = sel.slice(0, idx).concat(sel.slice(idx + 1));
      }
    }
    state.selected[qid] = sel;
    saveState();
    renderQuiz();
  }

  function renderQuiz() {
    var list = currentOrderList();
    scoreCorrectEl.textContent = state.correctCount;
    scoreTotalEl.textContent = state.attemptedCount;

    if (!list.length) {
      quizCard.innerHTML = '<div class="empty-state">No questions for this filter.</div>';
      progressFill.style.width = "0%";
      progressText.textContent = "";
      btnPrev.disabled = true; btnNext.disabled = true; btnSubmit.disabled = true;
      return;
    }

    if (state.index >= list.length) state.index = list.length - 1;
    if (state.index < 0) state.index = 0;

    var qid = list[state.index];
    var q = questionById(qid);
    var sel = state.selected[qid] || [];
    var answered = !!state.answered[qid];

    progressFill.style.width = Math.round(((state.index + 1) / list.length) * 100) + "%";
    progressText.textContent = "Question " + (state.index + 1) + " of " + list.length;

    btnPrev.disabled = state.index === 0;
    btnNext.disabled = state.index === list.length - 1;
    btnSubmit.disabled = answered || !sel.length || (q.type === "multi" && sel.length !== q.choose);
    btnSubmit.textContent = answered ? "Submitted" : "Submit";

    var chooseHint = q.type === "multi" ? '<div class="q-choose-hint">Choose ' + q.choose + ' answer' + (q.choose > 1 ? 's' : '') + (sel.length ? ' (' + sel.length + '/' + q.choose + ' selected)' : '') + '</div>' : '';

    var bulletsHtml = (q.bullets && q.bullets.length)
      ? '<ul class="q-bullets">' + q.bullets.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join("") + '</ul>'
      : '';
    var codeHtml = q.code ? '<pre class="q-code">' + escapeHtml(q.code) + '</pre>' : '';

    var optionsHtml = q.options.map(function (o) {
      var classes = ["quiz-option"];
      var isSelected = sel.indexOf(o.letter) !== -1;
      var isCorrectOpt = q.correct.indexOf(o.letter) !== -1;
      if (isSelected && !answered) classes.push("selected");
      if (answered) {
        classes.push("disabled");
        if (isCorrectOpt) classes.push("correct");
        else if (isSelected) classes.push("incorrect");
      }
      return '<div class="' + classes.join(" ") + '" data-letter="' + o.letter + '">' +
        '<span class="opt-marker">' + o.letter + '.</span>' +
        '<span>' + escapeHtml(o.text) + '</span>' +
        '</div>';
    }).join("");

    var banner = "";
    var whyBlock = "";
    if (answered) {
      var wasCorrect = arraysEqualAsSets(sel, q.correct);
      banner = '<div class="feedback-banner ' + (wasCorrect ? "correct" : "incorrect") + '">' +
        (wasCorrect ? "Correct!" : "Not quite — correct answer highlighted above.") + '</div>';
      var showWhy = !!state.showWhy[qid];
      whyBlock = '<button class="btn-secondary" id="why-toggle" type="button">' + (showWhy ? "Hide why" : "Why?") + '</button>' +
        (showWhy && q.explanation ? '<div class="q-explanation"><strong>Why:</strong> ' + escapeHtml(q.explanation) + '</div>' : '');
    }

    quizCard.innerHTML =
      '<div class="q-meta"><span class="badge">' + escapeHtml(q.exam) + '</span><span class="badge-num">Q' + q.number + '</span>' + markBtnHtml(q.id) + '</div>' +
      '<p class="q-stem">' + escapeHtml(q.stem) + '</p>' +
      bulletsHtml + codeHtml + chooseHint +
      '<div class="q-options" id="quiz-options">' + optionsHtml + '</div>' +
      banner + whyBlock;

    quizCard.querySelectorAll(".quiz-option").forEach(function (el) {
      el.addEventListener("click", function () {
        toggleOption(qid, el.dataset.letter, q);
      });
    });

    var quizMarkBtn = quizCard.querySelector(".mark-btn");
    if (quizMarkBtn) {
      quizMarkBtn.addEventListener("click", function () {
        toggleMarked(qid);
        renderQuiz();
      });
    }

    var whyBtn = document.getElementById("why-toggle");
    if (whyBtn) {
      whyBtn.addEventListener("click", function () {
        state.showWhy[qid] = !state.showWhy[qid];
        saveState();
        renderQuiz();
      });
    }
  }

  renderQuiz();
})();
