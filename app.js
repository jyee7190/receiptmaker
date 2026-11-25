/* ==========================================================
   CUTE RECEIPT MAKER  -  app.js
   1) state + helpers   2) editor table   3) export pages
   ========================================================== */
(() => {
  "use strict";

  const ROWS_PER_PAGE = 10;
  const EXPORT_W = 900;
  const SIZES = { png: { w: 900, h: 1200 }, pdf: { w: 900, h: 1273 } }; // 3:4  and  A4 (1 : 1.414)

  /* ---------- 1) STATE + HELPERS ---------- */
  const state = { type: "invoice", date: todayISO(), ref: "", rows: [] };

  function todayISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const rowTotal = (r) => (Number(r.qty) || 0) * (Number(r.price) || 0);
  const grandTotal = () => state.rows.reduce((s, r) => s + Math.round(rowTotal(r) * 100), 0) / 100;
  const digitsOnly = (v) => v.replace(/\D/g, "");
  function decimalOnly(v) {
    v = v.replace(/[^\d.]/g, "");
    const i = v.indexOf(".");
    if (i > -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "").slice(0, 2);
    return v;
  }
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);

  /* ---------- AUTOSAVE (this phone's browser only, nothing is uploaded) ----------
     Saves ~0.7s after the user stops typing, plus when the tab is hidden or closed.
     It only writes when something changed, so it costs almost nothing. */
  const DRAFT_KEY = "receiptDraft.v1";
  const TYPES = ["quotation", "invoice", "receipt"];
  let saveTimer = null;

  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ type: state.type, date: state.date, ref: state.ref, rows: state.rows })); } catch (e) {}
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); }
  function flushSave() { if (saveTimer) saveNow(); }

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (!d || !Array.isArray(d.rows) || !d.rows.length) return null;
      const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
      return {
        type: TYPES.includes(d.type) ? d.type : "invoice",
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : todayISO(),
        ref: str(d.ref, 16),
        rows: d.rows.slice(0, 200).map((r) => ({
          no: digitsOnly(str(r && r.no, 3)),
          item: str(r && r.item, 30),
          qty: digitsOnly(str(r && r.qty, 5)),
          price: decimalOnly(str(r && r.price, 9)),
        })),
      };
    } catch (e) { return null; }
  }

  /* ---------- 2) EDITOR TABLE ---------- */
  const rowsEl = $("rows");

  function newRow() {
    const max = state.rows.reduce((m, r) => Math.max(m, Number(r.no) || 0), 0);
    return { no: String(max + 1), item: "", qty: "1", price: "" };
  }

  function addRow(focus) {
    const row = newRow();
    state.rows.push(row);
    const el = buildRowEl(row);
    rowsEl.appendChild(el);
    updateTotals();
    if (focus) el.querySelector("input.item").focus();
  }

  function buildRowEl(row) {
    const el = document.createElement("div");
    el.className = "row";
    el.innerHTML = `
      <div class="cell vl"><input class="no" inputmode="numeric" maxlength="3" aria-label="item number"></div>
      <div class="cell vl"><input class="item" type="text" maxlength="30" autocomplete="off" aria-label="item name"></div>
      <div class="cell vl"><input class="qty" inputmode="numeric" maxlength="5" aria-label="quantity"></div>
      <div class="cell vl"><input class="price" inputmode="decimal" maxlength="9" placeholder="0.00" aria-label="price per unit"></div>
      <div class="cell"><div class="rowtotal">0.00</div></div>
      <div class="cell"><button type="button" class="del" aria-label="remove row">×</button></div>`;

    const inp = (c) => el.querySelector("input." + c);
    inp("no").value = row.no;
    inp("item").value = row.item;
    inp("qty").value = row.qty;
    inp("price").value = row.price;

    inp("no").addEventListener("input", (e) => { e.target.value = row.no = digitsOnly(e.target.value); });
    inp("item").addEventListener("input", (e) => { row.item = e.target.value; });
    inp("qty").addEventListener("input", (e) => { e.target.value = row.qty = digitsOnly(e.target.value); updateTotals(); });
    inp("price").addEventListener("input", (e) => { e.target.value = row.price = decimalOnly(e.target.value); updateTotals(); });

    el.querySelector(".del").addEventListener("click", () => {
      if (state.rows.length === 1) { // keep one row, just clear it
        Object.assign(row, { item: "", qty: "1", price: "" });
        inp("item").value = ""; inp("qty").value = "1"; inp("price").value = "";
      } else {
        state.rows.splice(state.rows.indexOf(row), 1);
        el.remove();
      }
      updateTotals();
      scheduleSave();
    });

    el._row = row;
    return el;
  }

  function updateTotals() {
    [...rowsEl.children].forEach((el) => {
      el.querySelector(".rowtotal").textContent = money(rowTotal(el._row));
    });
    $("grandTotal").textContent = money(grandTotal());
  }

  function fillEditor() {
    $("date").value = state.date;
    $("ref").value = state.ref;
    $("docType").value = state.type;
    rowsEl.innerHTML = "";
    state.rows.forEach((r) => rowsEl.appendChild(buildRowEl(r)));
    updateTotals();
  }

  const draft = loadDraft();
  if (draft) Object.assign(state, draft);
  else for (let i = 0; i < 3; i++) state.rows.push(newRow()), (state.rows[i].no = String(i + 1));
  fillEditor();

  $("date").addEventListener("input", (e) => { state.date = e.target.value; });
  $("ref").addEventListener("input", (e) => { state.ref = e.target.value; });
  $("docType").addEventListener("change", (e) => { state.type = e.target.value; });
  $("addRow").addEventListener("click", () => { addRow(true); scheduleSave(); });
  $("editor").addEventListener("input", scheduleSave);
  $("editor").addEventListener("change", scheduleSave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
  window.addEventListener("pagehide", flushSave);

  $("startOver").addEventListener("click", () => {
    if (!window.confirm("Start over? This clears everything you typed.")) return;
    clearTimeout(saveTimer); saveTimer = null;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    Object.assign(state, { type: "invoice", date: todayISO(), ref: "", rows: [] });
    for (let i = 1; i <= 3; i++) state.rows.push({ no: String(i), item: "", qty: "1", price: "" });
    fillEditor();
  });

  /* ---------- 3) EXPORT PAGES ---------- */
  const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="58" height="58" viewBox="0 0 60 60"><polygon points="30,4 37,22 56,23 41,35 46,54 30,43 14,54 19,35 4,23 23,22" fill="#f6e9c4" stroke="#7ea7c7" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  const STAR_URI = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(STAR_SVG);
  const STAR = (cls) => `<img class="star ${cls}" src="${STAR_URI}" width="58" height="58" alt="">`;

  // receipt paper with wavy top + bottom edge (SVG so html2canvas can draw it)
  function paperSvg(w, h) {
    const amp = 12;
    const n = Math.round(w / 32) * 2;          // even number of zigzag steps
    const step = w / n;
    const x = (i) => (i * step).toFixed(1);
    let d = `M0,${amp}`;
    for (let i = 1; i <= n; i++) d += ` L${x(i)},${i % 2 ? 0 : amp}`;           // top edge
    d += ` L${w},${h - amp}`;
    for (let i = n - 1; i >= 0; i--) d += ` L${x(i)},${i % 2 ? h : h - amp}`;   // bottom edge
    d += " Z";
    return `
      <svg class="xp-paper" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="${d}" transform="translate(8,9)" fill="rgba(0,40,70,0.18)"/>
        <path d="${d}" fill="#fffaf0" stroke="#7ea7c7" stroke-width="2" stroke-linejoin="round"/>
      </svg>`;
  }

  function buildPage(rows, pageNo, pageCount, kind) {
    const { w, h } = SIZES[kind];
    const margin = 50;
    const pw = w - margin * 2, ph = h - margin * 2;
    const isLast = pageNo === pageCount;

    const col = (cls, fn, line) =>
      `<div class="xp-col ${cls} ${line ? "vl" : ""}">${rows.map((r) => `<div>${r._blank ? "" : fn(r)}</div>`).join("")}</div>`;

    const page = document.createElement("div");
    page.className = "xp";
    page.style.width = w + "px";
    page.style.height = h + "px";
    page.innerHTML = `
      <div style="position:absolute;left:${margin}px;top:${margin}px;width:${pw}px;height:${ph}px">
        ${paperSvg(pw, ph)}
        <div class="xp-content" style="left:0;top:0;width:${pw}px;height:${ph}px">
          <div class="xp-meta">
            <div class="f">date :<div class="v">${esc(fmtDate(state.date))}</div></div>
            <div class="f">ref no :<div class="v">${esc(state.ref)}</div></div>
          </div>
          <div class="xp-banner">${STAR("l")}${esc(state.type)}${STAR("r")}</div>
          <div class="xp-table">
            <div class="xp-cols xp-head">
              <div class="vl">no.</div><div class="vl">item</div><div class="vl">qty</div><div class="vl">price per unit</div><div>total</div>
            </div>
            <div class="xp-cols xp-body">
              ${col("c-no", (r) => esc(r.no), true)}
              ${col("c-item", (r) => `<span>${esc(r.item)}</span>`, true)}
              ${col("c-qty", (r) => esc(r.qty), true)}
              ${col("c-price", (r) => (r.price === "" ? "" : money(Number(r.price) || 0)), true)}
              ${col("c-total", (r) => money(rowTotal(r)), false)}
            </div>
          </div>
          <div class="xp-foot">
            ${isLast ? `<span>total</span><span>${money(grandTotal())}</span>` : `<span class="cont">continued on next page…</span>`}
          </div>
          <div class="xp-pageno">page ${pageNo}${pageCount > 1 ? " / " + pageCount : ""}</div>
        </div>
      </div>`;
    return page;
  }

  function filledRows() {
    return state.rows.filter((r) => r.item.trim() || r.price !== "");
  }

  async function renderPages(kind) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const rows = filledRows();
    const chunks = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
    if (!chunks.length) chunks.push([]);

    const stage = $("exportStage");
    const canvases = [];
    for (let i = 0; i < chunks.length; i++) {
      const rows10 = chunks[i];
      // pad to 10 slots so empty lines stay visible like the sketch
      const padded = rows10.concat(Array.from({ length: ROWS_PER_PAGE - rows10.length }, () => ({ _blank: true })));
      const node = buildPage(padded, i + 1, chunks.length, kind);
      stage.appendChild(node);
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#2596be", useCORS: true, logging: false });
      canvases.push(canvas);
      node.remove();
    }
    return canvases;
  }

  function fileBase() {
    const ref = state.ref.trim().replace(/[^\w-]+/g, "") || "untitled";
    return `${state.type}-${ref}`;
  }

  function download(blobOrUrl, name) {
    const a = document.createElement("a");
    a.href = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run(kind, btn) {
    const status = $("status");
    const buttons = [$("exportPng"), $("exportPdf")];
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = "printing your receipt…";
    try {
      const canvases = await renderPages(kind === "png" ? "png" : "pdf");
      if (kind === "png") {
        for (let i = 0; i < canvases.length; i++) {
          const blob = await new Promise((res) => canvases[i].toBlob(res, "image/png"));
          download(blob, canvases.length > 1 ? `${fileBase()}-p${i + 1}.png` : `${fileBase()}.png`);
          if (i < canvases.length - 1) await wait(500);
        }
      } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        canvases.forEach((c, i) => {
          if (i > 0) doc.addPage();
          doc.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
        });
        doc.save(`${fileBase()}.pdf`);
      }
      status.textContent = canvases.length > 1 ? `done! ${canvases.length} pages saved.` : "done! saved.";
    } catch (err) {
      console.error(err);
      status.textContent = "oops, something went wrong. please try again.";
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  $("exportPng").addEventListener("click", () => run("png"));
  $("exportPdf").addEventListener("click", () => run("pdf"));

  // exposed for testing
  window.__receipt = { state, saveNow, money, rowTotal, grandTotal, renderPages, addRow };
})();
