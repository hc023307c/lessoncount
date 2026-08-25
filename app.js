import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const runtimeConfig = window.LESSONCOUNT_CONFIG || {};
const config = {
  supabaseUrl: runtimeConfig.supabaseUrl,
  supabaseAnonKey: runtimeConfig.supabaseAnonKey,
  totalPages: Number(runtimeConfig.totalPages || 58),
  sutraTitle: "\u89c0\u4e16\u97f3\u83e9\u85a9\u666e\u9580\u54c1",
  sourceUrl: "https://sutra.ddm.org.tw/ebook/22/",
  basicHtmlBaseUrl: "https://sutra.ddm.org.tw/ebook/22/files/basic-html",
};

const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

const progressCacheKey = "lessoncount.progress";
const pendingPageKey = "lessoncount.pendingPage";

const state = {
  session: null,
  user: null,
  page: 1,
  cycleStartedAt: new Date().toISOString(),
  currentCycleCompleted: false,
  stats: { total: 0, today: 0, lastCompletionTime: null },
  completions: [],
  saving: false,
  online: navigator.onLine,
  notice: "",
  ignoreNextFrameLoad: true,
};

const app = document.querySelector("#app");

function clampPage(page, totalPages = config.totalPages) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.round(page), 1), totalPages);
}

function officialPageUrl(page) {
  const safePage = clampPage(page);
  return safePage === 1
    ? `${config.basicHtmlBaseUrl}/index.html`
    : `${config.basicHtmlBaseUrl}/page${safePage}.html`;
}

function canComplete(page, isCompleted) {
  return page >= config.totalPages && !isCompleted;
}

function localDayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "None";
}

function render() {
  if (!supabase) {
    app.innerHTML = `
      <main class="shell">
        <section class="empty-state">
          <h1>Practice Tracker</h1>
          <p>Missing Supabase frontend configuration.</p>
          <code>Copy config.example.js to config.js and fill your Supabase URL and anon key.</code>
        </section>
      </main>
    `;
    return;
  }

  if (!state.user) {
    app.innerHTML = `
      <main class="auth-shell">
        <section class="auth-panel">
          <p class="kicker">${config.sutraTitle}</p>
          <h1>Practice Tracker</h1>
          <form id="login-form" class="auth-form">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="you@example.com" />
            <button type="submit">Send sign-in code</button>
          </form>
          <p class="source">Source: <a href="${config.sourceUrl}" target="_blank" rel="noopener noreferrer">Dharma Drum Mountain Buddhist Sutras</a></p>
          ${state.notice ? `<p class="notice">${state.notice}</p>` : ""}
        </section>
      </main>
    `;
    bindAuth();
    return;
  }

  const completionAvailable = canComplete(state.page, state.currentCycleCompleted);
  const progressPercent = Math.round((state.page / config.totalPages) * 100);
  const cycleLabel = state.currentCycleCompleted ? "Cycle counted" : "Current cycle active";
  const nextLabel = state.page >= config.totalPages ? "Finish + Next" : "Next";

  state.ignoreNextFrameLoad = true;

  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div class="title-block">
          <p class="kicker">${config.sutraTitle}</p>
          <h1>Reading Practice</h1>
        </div>
        <div class="header-actions">
          <span class="sync-pill">${state.online ? "Online" : "Offline"}${state.saving ? " / Saving" : ""}</span>
          <button id="sign-out" class="ghost-button compact-button" type="button">Sign out</button>
        </div>
      </header>

      <section class="dashboard" aria-label="Practice status">
        <article class="progress-card">
          <div class="progress-card-header">
            <span>Current page</span>
            <strong>${state.page} / ${config.totalPages}</strong>
          </div>
          <div class="progress-track" aria-label="Reading progress">
            <span style="width: ${progressPercent}%"></span>
          </div>
          <small>${progressPercent}% complete</small>
        </article>
        <article><span>Total</span><strong>${state.stats.total}</strong></article>
        <article><span>Today</span><strong>${state.stats.today}</strong></article>
        <article><span>Last</span><strong>${formatDateTime(state.stats.lastCompletionTime)}</strong></article>
      </section>

      <section class="reader">
        ${
          completionAvailable
            ? `<div class="completion-banner">
                <div>
                  <strong>Final page reached</strong>
                  <span>Confirm once to record this practice.</span>
                </div>
                <button id="complete-cycle-top" type="button">Confirm completion</button>
              </div>`
            : ""
        }
        <div class="reader-toolbar">
          <button id="previous-page" class="nav-button" type="button" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
          <form id="page-form" class="page-form">
            <label for="page-input">Page</label>
            <div class="page-input-row">
              <input id="page-input" name="page" type="number" min="1" max="${config.totalPages}" value="${state.page}" />
              <span>/ ${config.totalPages}</span>
            </div>
          </form>
          ${
            completionAvailable
              ? `<button id="next-page" class="nav-button primary-action" type="button">${nextLabel}</button>`
              : `<button id="next-page" class="nav-button" type="button">${nextLabel}</button>`
          }
        </div>

        <div class="reader-frame">
          <iframe title="${config.sutraTitle} official source page ${state.page}" src="${officialPageUrl(state.page)}" loading="lazy" referrerpolicy="no-referrer"></iframe>
        </div>

        <div class="reader-actions">
          <a href="${officialPageUrl(state.page)}" target="_blank" rel="noopener noreferrer">Open official page</a>
          <button id="new-cycle" class="text-button" type="button">Start new cycle</button>
        </div>
      </section>

      <section class="history">
        <div class="section-title">
          <h2>Recent completions</h2>
          <span>${cycleLabel}</span>
        </div>
        ${
          state.completions.length
            ? `<ol>${state.completions
                .map((item) => `<li><time>${formatDateTime(item.completed_at)}</time><span>Page ${item.completed_page}</span></li>`)
                .join("")}</ol>`
            : "<p>No completions yet.</p>"
        }
      </section>

      <footer>
        <span>Official source only. Sutra content is not copied or redistributed.</span>
        <a href="${config.sourceUrl}" target="_blank" rel="noopener noreferrer">Attribution</a>
      </footer>

      <nav class="mobile-action-bar" aria-label="Reading controls">
        <button id="previous-page-mobile" type="button" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
        <span>${state.page} / ${config.totalPages}</span>
        ${
          completionAvailable
            ? `<button id="next-page-mobile" class="primary-action" type="button">${nextLabel}</button>`
            : `<button id="next-page-mobile" type="button">${nextLabel}</button>`
        }
      </nav>
    </main>
  `;

  bindApp();
}

function bindAuth() {
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });

    state.notice = error ? error.message : "Check your email for the sign-in link.";
    render();
  });
}

function bindApp() {
  document.querySelector("#sign-out")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  document.querySelector("#previous-page")?.addEventListener("click", () => setPage(state.page - 1));
  document.querySelector("#next-page")?.addEventListener("click", advancePage);
  document.querySelector("#previous-page-mobile")?.addEventListener("click", () => setPage(state.page - 1));
  document.querySelector("#next-page-mobile")?.addEventListener("click", advancePage);
  document.querySelector("iframe")?.addEventListener("load", handleFrameLoad);

  document.querySelector("#page-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#page-input");
    setPage(Number(input?.value || 1));
  });

  document.querySelector("#page-input")?.addEventListener("change", (event) => {
    setPage(Number(event.target.value || 1));
  });

  document.querySelector("#complete-cycle-top")?.addEventListener("click", completeCycle);
  document.querySelector("#new-cycle")?.addEventListener("click", startNewCycle);
}

async function handleFrameLoad() {
  if (state.ignoreNextFrameLoad) {
    state.ignoreNextFrameLoad = false;
    return;
  }

  await advancePage();
}

async function loadSession() {
  if (!supabase) {
    render();
    return;
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      state.notice = error.message;
    } else {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user ?? null;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user ?? null;
    if (state.user) await hydrateUserState();
    render();
  });

  if (state.user) await hydrateUserState();
  render();
}

async function hydrateUserState() {
  loadLocalProgress();
  await Promise.all([loadProgress(), loadCompletions()]);
  await flushPendingPage();
}

function loadLocalProgress() {
  const cached = localStorage.getItem(progressCacheKey);
  if (!cached) return;

  try {
    const progress = JSON.parse(cached);
    state.page = clampPage(progress.current_page);
    state.cycleStartedAt = progress.cycle_started_at || state.cycleStartedAt;
    state.currentCycleCompleted = Boolean(progress.current_cycle_completed);
  } catch {
    localStorage.removeItem(progressCacheKey);
  }
}

async function loadProgress() {
  if (!state.user) return;

  const { data, error } = await supabase
    .from("reading_progress")
    .select("current_page, cycle_started_at, current_cycle_completed, updated_at")
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (error) {
    state.notice = error.message;
    return;
  }

  if (data) {
    state.page = clampPage(data.current_page);
    state.cycleStartedAt = data.cycle_started_at;
    state.currentCycleCompleted = data.current_cycle_completed;
    cacheProgress();
  } else {
    await saveProgress();
  }
}

async function loadCompletions() {
  if (!state.user) return;

  const today = localDayRange();
  const [{ data, error, count }, todayResult] = await Promise.all([
    supabase
      .from("practice_completions")
      .select("id, completed_at, cycle_started_at, completed_page", { count: "exact" })
      .eq("user_id", state.user.id)
      .order("completed_at", { ascending: false })
      .limit(25),
    supabase
      .from("practice_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", state.user.id)
      .gte("completed_at", today.startIso)
      .lt("completed_at", today.endIso),
  ]);

  if (error || todayResult.error) {
    state.notice = error?.message || todayResult.error?.message || "";
    return;
  }

  state.completions = data || [];
  state.stats = {
    total: count ?? state.completions.length,
    today: todayResult.count ?? 0,
    lastCompletionTime: state.completions[0]?.completed_at ?? null,
  };
}

function cacheProgress() {
  localStorage.setItem(
    progressCacheKey,
    JSON.stringify({
      current_page: state.page,
      cycle_started_at: state.cycleStartedAt,
      current_cycle_completed: state.currentCycleCompleted,
      updated_at: new Date().toISOString(),
    }),
  );
}

async function setPage(page) {
  state.page = clampPage(page);
  cacheProgress();
  render();
  await saveProgress();
}

async function advancePage() {
  if (state.page >= config.totalPages) {
    if (state.currentCycleCompleted) {
      await startNewCycle();
      return;
    }

    await completeCycle({ restart: true, confirm: false });
    return;
  }

  await setPage(state.page + 1);
}

async function saveProgress() {
  if (!state.user) return;

  cacheProgress();
  if (!navigator.onLine) {
    localStorage.setItem(pendingPageKey, String(state.page));
    return;
  }

  state.saving = true;
  render();

  const { error } = await supabase.from("reading_progress").upsert({
    user_id: state.user.id,
    current_page: state.page,
    cycle_started_at: state.cycleStartedAt,
    current_cycle_completed: state.currentCycleCompleted,
    updated_at: new Date().toISOString(),
  });

  state.saving = false;
  if (error) {
    localStorage.setItem(pendingPageKey, String(state.page));
    state.notice = error.message;
  } else {
    localStorage.removeItem(pendingPageKey);
  }

  render();
}

async function flushPendingPage() {
  const pending = localStorage.getItem(pendingPageKey);
  if (!pending || !navigator.onLine) return;

  state.page = clampPage(Number(pending));
  await saveProgress();
}

async function completeCycle(options = {}) {
  if (!state.user || !canComplete(state.page, state.currentCycleCompleted)) return;

  const shouldConfirm = options.confirm ?? true;
  const shouldRestart = options.restart ?? false;
  if (shouldConfirm) {
    const confirmed = window.confirm("Record one completed practice for this reading cycle?");
    if (!confirmed) return;
  }

  const { error } = await supabase.from("practice_completions").insert({
    user_id: state.user.id,
    cycle_started_at: state.cycleStartedAt,
    completed_page: config.totalPages,
  });

  if (error) {
    state.notice = error.code === "23505" ? "This reading cycle was already counted." : error.message;
  }

  state.currentCycleCompleted = true;
  await saveProgress();
  await loadCompletions();

  if (shouldRestart) {
    state.page = 1;
    state.cycleStartedAt = new Date().toISOString();
    state.currentCycleCompleted = false;
    cacheProgress();
    await saveProgress();
  }

  render();
}

async function startNewCycle() {
  state.page = 1;
  state.cycleStartedAt = new Date().toISOString();
  state.currentCycleCompleted = false;
  cacheProgress();
  await saveProgress();
  render();
}

window.addEventListener("online", async () => {
  state.online = true;
  await flushPendingPage();
  render();
});

window.addEventListener("offline", () => {
  state.online = false;
  render();
});

render();
loadSession();
