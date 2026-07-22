(function () {
  const statusEl = document.getElementById("run-status");
  const actionLog = document.getElementById("action-log");
  const actionMeta = document.getElementById("action-meta");
  const actionPanel = document.getElementById("action-panel");
  const envLog = document.getElementById("env-log");
  const verdictEl = document.getElementById("verdict");
  const buttons = [document.getElementById("btn-smtp"), document.getElementById("btn-submit")];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function badge(ok) {
    if (ok === true) return ["ok", "OK"];
    if (ok === false) return ["fail", "FAIL"];
    return ["info", "INFO"];
  }
  function renderLog(el, entries) {
    if (!entries || !entries.length) {
      el.innerHTML = '<li class="empty">No steps returned.</li>';
      return;
    }
    el.innerHTML = entries
      .map((e) => {
        const [cls, label] = badge(e.ok);
        const detail = e.detail ? `<pre class="detail">${esc(e.detail)}</pre>` : "";
        return `<li><span class="badge ${cls}">${label}</span><span class="title">${esc(e.n)}. ${esc(e.title)}</span>${detail}</li>`;
      })
      .join("");
  }
  function showVerdict(v) {
    if (!v) {
      verdictEl.className = "verdict";
      verdictEl.innerHTML = "";
      return;
    }
    let cls = "warn";
    if (v.ok === true) cls = "ok";
    if (v.ok === false) cls = "fail";
    verdictEl.className = "verdict show " + cls;
    verdictEl.innerHTML = `<h2>${esc(v.title)}</h2><pre>${esc(v.detail || "")}</pre>`;
    verdictEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function setBusy(busy, label) {
    buttons.forEach((b) => {
      if (!b) return;
      b.disabled = busy;
      b.classList.toggle("is-busy", busy);
    });
    if (busy) {
      statusEl.className = "status busy";
      statusEl.textContent = label || "Running…";
    }
  }

  async function api(action, extra) {
    const res = await fetch("?ajax=" + encodeURIComponent(action), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify(Object.assign({ action }, extra || {})),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Non-JSON (" + res.status + "): " + text.slice(0, 240));
    }
    if (!res.ok || data.ok === false) throw new Error(data.error || "HTTP " + res.status);
    return data;
  }

  async function run(action) {
    const started = Date.now();
    const label = action === "smtp_direct" ? "Sending via SMTP…" : "POSTing submit.php…";
    actionLog.innerHTML = '<li class="empty">Running… previous results cleared.</li>';
    actionMeta.textContent = " — running…";
    actionPanel.classList.remove("flash");
    void actionPanel.offsetWidth;
    actionPanel.classList.add("flash");
    showVerdict(null);
    setBusy(true, label);

    try {
      const extra =
        action === "smtp_direct"
          ? { test_to: document.getElementById("test_to").value.trim() }
          : {};
      const data = await api(action, extra);
      renderLog(actionLog, data.log || []);
      showVerdict(data.verdict);
      actionMeta.textContent = " — finished in " + (Date.now() - started) + "ms";
      statusEl.className = "status done";
      statusEl.textContent = "Done — see verdict + Action log.";
    } catch (err) {
      actionLog.innerHTML = '<li class="empty">Request failed.</li>';
      showVerdict({ ok: false, title: "Test request failed", detail: String(err.message || err) });
      actionMeta.textContent = " — failed";
      statusEl.className = "status err";
      statusEl.textContent = "Error: " + (err.message || err);
    } finally {
      setBusy(false);
    }
  }

  document.getElementById("btn-smtp").addEventListener("click", () => run("smtp_direct"));
  document.getElementById("btn-submit").addEventListener("click", () => run("submit_post"));

  api("env")
    .then((data) => {
      renderLog(envLog, data.log || []);
      showVerdict(data.verdict);
    })
    .catch((err) => {
      envLog.innerHTML = '<li class="empty">Could not load environment: ' + esc(err.message) + "</li>";
    });
})();
