// =========================================================
// Focus Dashboard — script.js
// Vanilla JS. All data persists in localStorage (client-side only).
// =========================================================
(function () {
  "use strict";

  /* ---------- Storage helpers ---------- */
  // Small wrapper so every read/write is safe against quota / parse errors.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage full or disabled — fail silently */
      }
    }
  };

  const KEYS = {
    theme: "focusdash.theme",
    name: "focusdash.name",
    duration: "focusdash.timerDuration",
    todos: "focusdash.todos",
    links: "focusdash.links"
  };

  /* ---------- DOM shortcut ---------- */
  const $ = (id) => document.getElementById(id);

  /* =========================================================
     Clock + greeting
     ========================================================= */
  function updateClock() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $("date").textContent = now.toLocaleDateString([], {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    updateGreeting(now);
  }

  function updateGreeting(now) {
    const h = now.getHours();
    let part;
    if (h < 12) part = "Good morning,";
    else if (h < 18) part = "Good afternoon,";
    else if (h < 22) part = "Good evening,";
    else part = "Good night,";
    $("greeting-text").textContent = part;
  }

  function renderName() {
    const name = store.get(KEYS.name, "");
    $("greeting-name").textContent = name || "friend";
  }

  /* =========================================================
     Theme (light / dark)
     ========================================================= */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $("theme-toggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
    store.set(KEYS.theme, theme);
  }

  /* =========================================================
     Focus timer (Pomodoro-style, custom duration)
     ========================================================= */
  const timer = {
    remaining: 25 * 60, // seconds left
    total: 25 * 60,     // configured length in seconds
    intervalId: null,
    running: false
  };

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function renderTimer() {
    $("timer-display").textContent = fmt(timer.remaining);
    $("timer-display").classList.toggle("running", timer.running);
    $("timer-start").disabled = timer.running;
    $("timer-stop").disabled = !timer.running;
    if (timer.running) {
      $("timer-status").textContent = "Focusing…";
    } else if (timer.remaining === timer.total) {
      $("timer-status").textContent = "Ready to focus";
    } else if (timer.remaining === 0) {
      $("timer-status").textContent = "Time's up! 🎉";
    } else {
      $("timer-status").textContent = "Paused";
    }
  }

  function startTimer() {
    if (timer.running) return;
    if (timer.remaining <= 0) timer.remaining = timer.total; // restart if finished
    timer.running = true;
    renderTimer();
    timer.intervalId = setInterval(tick, 1000);
  }

  function tick() {
    timer.remaining--;
    if (timer.remaining <= 0) {
      timer.remaining = 0;
      stopTimer();
      onTimerComplete();
    }
    renderTimer();
  }

  function stopTimer() {
    timer.running = false;
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    renderTimer();
  }

  function resetTimer() {
    stopTimer();
    timer.remaining = timer.total;
    renderTimer();
  }

  function applyDuration() {
    let mins = parseInt($("timer-duration").value, 10);
    if (isNaN(mins) || mins < 1) mins = 1;
    if (mins > 120) mins = 120;
    $("timer-duration").value = mins;
    timer.total = mins * 60;
    stopTimer();
    timer.remaining = timer.total;
    store.set(KEYS.duration, mins);
    renderTimer();
  }

  function onTimerComplete() {
    $("timer-status").textContent = "Time's up! 🎉";
    beep();
  }

  // Gentle completion tone via the Web Audio API (no asset needed).
  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) { /* audio not available */ }
  }

  /* =========================================================
     To-Do list
     ========================================================= */
  let todos = store.get(KEYS.todos, []);

  function saveTodos() { store.set(KEYS.todos, todos); }

  function addTodo(text) {
    text = (text || "").trim();
    if (!text) return;
    todos.push({ id: Date.now(), text: text, done: false });
    saveTodos();
    renderTodos();
  }

  function toggleTodo(id) {
    const t = todos.find((x) => x.id === id);
    if (t) {
      t.done = !t.done;
      saveTodos();
      renderTodos();
    }
  }

  function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    saveTodos();
    renderTodos();
  }

  function clearDone() {
    todos = todos.filter((t) => !t.done);
    saveTodos();
    renderTodos();
  }

  function startEdit(id, li) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const textEl = li.querySelector(".todo-text");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "todo-edit-input";
    input.value = todo.text;
    input.maxLength = 200;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const v = input.value.trim();
      if (v) todo.text = v;
      saveTodos();
      renderTodos();
    };
    const cancel = () => {
      if (committed) return;
      committed = true;
      renderTodos();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    input.addEventListener("blur", commit);
  }

  function renderTodos() {
    const list = $("todo-list");
    list.innerHTML = "";

    todos.forEach((t) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (t.done ? " done" : "");
      li.dataset.id = t.id;

      const check = document.createElement("button");
      check.type = "button";
      check.className = "todo-check";
      check.textContent = "✓";
      check.title = t.done ? "Mark as not done" : "Mark as done";
      check.addEventListener("click", () => toggleTodo(t.id));

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = t.text;

      const actions = document.createElement("div");
      actions.className = "todo-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "✏️";
      editBtn.title = "Edit";
      editBtn.addEventListener("click", () => startEdit(t.id, li));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn";
      delBtn.textContent = "🗑️";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", () => deleteTodo(t.id));

      actions.append(editBtn, delBtn);
      li.append(check, text, actions);
      list.appendChild(li);
    });

    updateTodoCount();
  }

  function updateTodoCount() {
    const left = todos.filter((t) => !t.done).length;
    const total = todos.length;
    $("todo-count").textContent =
      total === 0 ? "0 tasks"
        : left + " of " + total + " task" + (total === 1 ? "" : "s") + " left";
  }

  /* =========================================================
     Quick links
     ========================================================= */
  let links = store.get(KEYS.links, []);

  function saveLinks() { store.set(KEYS.links, links); }

  function addLink(name, url) {
    name = (name || "").trim();
    url = (url || "").trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url; // be forgiving
    links.push({ id: Date.now(), name: name, url: url });
    saveLinks();
    renderLinks();
  }

  function deleteLink(id) {
    links = links.filter((l) => l.id !== id);
    saveLinks();
    renderLinks();
  }

  function renderLinks() {
    const wrap = $("links-list");
    wrap.innerHTML = "";

    if (links.length === 0) {
      const empty = document.createElement("p");
      empty.className = "links-empty";
      empty.textContent = "No quick links yet. Add your favourite sites above.";
      wrap.appendChild(empty);
      return;
    }

    links.forEach((l) => {
      const item = document.createElement("div");
      item.className = "link-item";

      const a = document.createElement("a");
      a.className = "link-open";
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.name;
      a.title = l.url;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "link-delete";
      del.textContent = "✕";
      del.title = "Remove";
      del.addEventListener("click", () => deleteLink(l.id));

      item.append(a, del);
      wrap.appendChild(item);
    });
  }

  /* =========================================================
     Wire everything up
     ========================================================= */
  function init() {
    // ---- Theme ----
    const savedTheme = store.get(KEYS.theme, null);
    const theme = savedTheme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(theme);
    $("theme-toggle").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "dark" ? "light" : "dark");
    });

    // ---- Name ----
    renderName();
    const saveName = () => {
      store.set(KEYS.name, $("name-input").value.trim());
      renderName();
      $("name-input").value = "";
    };
    $("save-name-btn").addEventListener("click", saveName);
    $("name-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveName(); }
    });

    // ---- Clock ----
    updateClock();
    setInterval(updateClock, 1000);

    // ---- Timer ----
    const savedDur = store.get(KEYS.duration, 25);
    $("timer-duration").value = savedDur;
    timer.total = savedDur * 60;
    timer.remaining = timer.total;
    renderTimer();
    $("timer-start").addEventListener("click", startTimer);
    $("timer-stop").addEventListener("click", stopTimer);
    $("timer-reset").addEventListener("click", resetTimer);
    $("timer-apply").addEventListener("click", applyDuration);
    $("timer-duration").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyDuration(); }
    });

    // ---- To-do ----
    renderTodos();
    $("todo-form").addEventListener("submit", (e) => {
      e.preventDefault();
      addTodo($("todo-input").value);
      $("todo-input").value = "";
      $("todo-input").focus();
    });
    $("todo-clear-done").addEventListener("click", clearDone);

    // ---- Quick links ----
    renderLinks();
    $("link-form").addEventListener("submit", (e) => {
      e.preventDefault();
      addLink($("link-name").value, $("link-url").value);
      $("link-name").value = "";
      $("link-url").value = "";
      $("link-name").focus();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
