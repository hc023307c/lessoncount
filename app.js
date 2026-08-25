import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const runtimeConfig = window.LESSONCOUNT_CONFIG || {};
const config = {
  supabaseUrl: runtimeConfig.supabaseUrl,
  supabaseAnonKey: runtimeConfig.supabaseAnonKey,
  totalPages: Number(runtimeConfig.totalPages || 58),
  sutraTitle: "\u89c0\u4e16\u97f3\u83e9\u85a9\u666e\u9580\u54c1",
  sourceUrl: "https://sutra.ddm.org.tw/ebook/22/",
  basicHtmlBaseUrl: "https://sutra.ddm.org.tw/ebook/22/files/basic-html",
  authRedirectUrl: runtimeConfig.authRedirectUrl || `${window.location.origin}${window.location.pathname}`,
};

const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
          flowType: "implicit",
        },
      })
    : null;

const progressCacheKey = "lessoncount.progress";
const pendingPageKey = "lessoncount.pendingPage";
const pageImageScaleKey = "lessoncount.pageImageScale";

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
  pageImageScale: loadPageImageScale(),
};

const app = document.querySelector("#app");

function clampPage(page, totalPages = config.totalPages) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.round(page), 1), totalPages);
}

function officialPageUrl(page) {
  const safePage = clampPage(page);
  return `${config.sourceUrl}index.html#p=${safePage}`;
}

function pageImageUrl(page) {
  const safePage = clampPage(page);
  return `${config.sourceUrl}files/mobile/${safePage}.jpg`;
}

function basicPageUrl(page) {
  const safePage = clampPage(page);
  return safePage === 1
    ? `${config.basicHtmlBaseUrl}/index.html`
    : `${config.basicHtmlBaseUrl}/page${safePage}.html`;
}

function canComplete(page, isCompleted) {
  return page >= config.totalPages && !isCompleted;
}

function loadPageImageScale() {
  const stored = Number(localStorage.getItem(pageImageScaleKey));
  if (Number.isFinite(stored) && stored >= 0.5 && stored <= 1) return stored;
  return window.innerWidth <= 720 ? 0.68 : 1;
}

function formatScalePercent(scale) {
  return `${Math.round(scale * 100)}%`;
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

      <div class="practice-layout">
        <section class="reader">
          ${
            completionAvailable
              ? `<div class="completion-banner">
                  <div>
                    <strong>Final page reached</strong>
                    <span>Tap the right side to count this practice and return to page 1.</span>
                  </div>
                </div>`
              : ""
          }
          <div class="reader-meta">
            <form id="page-form" class="page-form">
              <label for="page-input">Page</label>
              <div class="page-input-row">
                <input id="page-input" name="page" type="number" min="1" max="${config.totalPages}" value="${state.page}" />
                <span>/ ${config.totalPages}</span>
              </div>
            </form>
            <div class="mini-progress">
              <div class="progress-track" aria-label="Reading progress">
                <span style="width: ${progressPercent}%"></span>
              </div>
              <small>${progressPercent}% complete</small>
            </div>
          </div>

          <div class="reader-frame">
            <img class="sutra-page-image" style="--page-image-scale: ${state.pageImageScale}" src="${pageImageUrl(state.page)}" alt="${config.sutraTitle} page ${state.page}" loading="eager" referrerpolicy="no-referrer" />
          </div>

          <div class="reader-actions">
            <a href="${officialPageUrl(state.page)}" target="_blank" rel="noopener noreferrer">Open official page</a>
            <a href="${basicPageUrl(state.page)}" target="_blank" rel="noopener noreferrer">Basic page</a>
          </div>
          <div class="image-size-control">
            <label for="image-size">Size</label>
            <input id="image-size" type="range" min="50" max="100" step="2" value="${Math.round(state.pageImageScale * 100)}" />
            <strong id="image-size-value">${formatScalePercent(state.pageImageScale)}</strong>
          </div>
          <p class="reader-hint">Use the floating side buttons to keep page tracking accurate.</p>
        </section>

        <aside class="stats-panel" aria-label="Practice records">
          <section class="dashboard">
            <article><span>Total completed</span><strong>${state.stats.total}</strong></article>
            <article><span>Today</span><strong>${state.stats.today}</strong></article>
            <article><span>Last completion</span><strong>${formatDateTime(state.stats.lastCompletionTime)}</strong></article>
            <article><span>Status</span><strong>${cycleLabel}</strong></article>
          </section>

          <section class="history">
            <div class="section-title">
              <h2>Recent completions</h2>
            </div>
            ${
              state.completions.length
                ? `<ol>${state.completions
                    .map(
                      (item) => `
                        <li>
                          <div>
                            <time>${formatDateTime(item.completed_at)}</time>
                            <span>Page ${item.completed_page}</span>
                          </div>
                          <button class="delete-completion" type="button" data-completion-id="${item.id}" data-completed-at="${item.completed_at}">Delete</button>
                        </li>`,
                    )
                    .join("")}</ol>`
                : "<p>No completions yet.</p>"
            }
          </section>
        </aside>
      </div>

      <footer>
        <span>Official source only. Sutra content is not copied or redistributed.</span>
        <a href="${config.sourceUrl}" target="_blank" rel="noopener noreferrer">Attribution</a>
      </footer>

      <div class="fixed-reader-controls" aria-label="Reading controls">
        <button id="previous-page" class="floating-nav floating-nav-left" type="button" ${state.page <= 1 ? "disabled" : ""} aria-label="Previous page">
          <span>Previous</span>
        </button>
        <div class="floating-next-group">
          <button id="next-page" class="floating-nav floating-nav-right ${completionAvailable ? "finish-nav" : ""}" type="button" aria-label="${completionAvailable ? "Finish practice and go to page 1" : "Next page"}">
            <span>${completionAvailable ? "Finish" : "Next"}</span>
          </button>
          <div class="today-badge">Today ${state.stats.today}</div>
        </div>
      </div>

    </main>
  `;

  bindApp();
  updateFrameScale();
  updateFloatingControls();
}

function bindAuth() {
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: config.authRedirectUrl },
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
  document.querySelector("#page-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#page-input");
    setPage(Number(input?.value || 1));
  });

  document.querySelector("#page-input")?.addEventListener("change", (event) => {
    setPage(Number(event.target.value || 1));
  });

  document.querySelector("#image-size")?.addEventListener("input", (event) => {
    setPageImageScale(Number(event.target.value) / 100);
  });

  document.querySelector(".history")?.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-completion");
    if (!button) return;

    deleteCompletion(button.dataset.completionId, button.dataset.completedAt);
  });
}

function setPageImageScale(scale) {
  const nextScale = Math.min(Math.max(scale, 0.5), 1);
  state.pageImageScale = nextScale;
  localStorage.setItem(pageImageScaleKey, String(nextScale));
  document.querySelector(".sutra-page-image")?.style.setProperty("--page-image-scale", String(nextScale));

  const value = document.querySelector("#image-size-value");
  if (value) value.textContent = formatScalePercent(nextScale);
}

function updateFrameScale() {
  const frame = document.querySelector(".reader-frame");
  if (!frame) return;

  const nativeWidth = 910;
  const availableWidth = frame.clientWidth;
  const scale = 1;
  const compactViewport = window.innerWidth <= 720;
  const viewport = window.visualViewport;
  const visibleHeight = viewport?.height || window.innerHeight;
  const targetVisualHeight = compactViewport
    ? Math.min(Math.max(visibleHeight * 0.74, 520), visibleHeight - 120)
    : Math.min(Math.max(visibleHeight * 0.72, 540), 880);
  const nativeHeight = Math.ceil(targetVisualHeight);

  frame.style.setProperty("--frame-scale", String(scale));
  frame.style.setProperty("--frame-native-width", `${Math.max(availableWidth, nativeWidth)}px`);
  frame.style.setProperty("--frame-native-height", `${nativeHeight}px`);
}

function updateFloatingControls() {
  const viewport = window.visualViewport;
  const rawScale = viewport?.scale ? 1 / viewport.scale : 1;
  const scale = Math.min(Math.max(rawScale, 0.5), 1);
  const top = viewport ? viewport.offsetTop + viewport.height * 0.56 : window.innerHeight * 0.56;
  const right = viewport ? window.innerWidth - viewport.offsetLeft - viewport.width : 0;
  const left = viewport ? viewport.offsetLeft : 0;

  document.documentElement.style.setProperty("--control-scale", String(scale));
  document.documentElement.style.setProperty("--control-top", `${top}px`);
  document.documentElement.style.setProperty("--control-left", `${left}px`);
  document.documentElement.style.setProperty("--control-right", `${right}px`);
}

async function loadSession() {
  if (!supabase) {
    render();
    return;
  }

  await handleAuthRedirect();

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

async function handleAuthRedirect() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const hashError = hash.get("error_description") || hash.get("error");

  if (hashError) {
    state.notice = hashError;
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    state.notice = error ? error.message : "";
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    state.notice = `${error.message}. Please request a new sign-in link from the same browser.`;
  } else {
    state.notice = "";
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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

async function deleteCompletion(id, completedAt) {
  if (!state.user || !id) return;

  const confirmed = window.confirm(`Delete this completion record?\n${formatDateTime(completedAt)}`);
  if (!confirmed) return;

  state.saving = true;
  render();

  const { error } = await supabase
    .from("practice_completions")
    .delete()
    .eq("id", id)
    .eq("user_id", state.user.id);

  state.saving = false;
  state.notice = error ? error.message : "";
  await loadCompletions();
  render();
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
    await finishAndStartNextCycle();
    return;
  }

  await setPage(state.page + 1);
}

async function finishAndStartNextCycle() {
  if (!state.user) return;

  if (state.currentCycleCompleted) {
    await startNewCycle();
    return;
  }

  await completeCycle({ restart: true, confirm: false });
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
    if (error.code !== "23505") {
      render();
      return;
    }
  }

  if (shouldRestart) {
    state.page = 1;
    state.cycleStartedAt = new Date().toISOString();
    state.currentCycleCompleted = false;
    cacheProgress();
    await saveProgress();
    await loadCompletions();
    render();
    return;
  }

  state.currentCycleCompleted = true;
  await saveProgress();
  await loadCompletions();
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

window.addEventListener("resize", () => {
  updateFrameScale();
  updateFloatingControls();
});

window.visualViewport?.addEventListener("resize", updateFloatingControls);
window.visualViewport?.addEventListener("scroll", updateFloatingControls);

render();
loadSession();
