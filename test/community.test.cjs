"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const html = fs.readFileSync(__dirname + "/../vip-panel.html", "utf8"),
  source = fs.readFileSync(__dirname + "/../js/icadem-community.js", "utf8");
function ui() {
  const ctx = {
    window: {
      ICADEMDirectory: { appearance: () => ({ color: "#e9bc43", image: "" }) },
    },
    URL,
    document: {addEventListener:()=>{}},
    location: { origin: "https://example.test" },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../js/icadem-professional-profile.js', 'utf8'), ctx);
  vm.runInNewContext(source, ctx);
  return ctx.window.ICADEMCommunity;
}
test("professional profiles render only returned contacts, escape CV fields and identify self-reported education", () => {
  const member = {
    uid: "b",
    nombre: "<img src=x onerror=alert(1)>",
    cv: {
      resumen: "<script>alert(1)</script>",
      formacion: [
        {
          titulo: "Certificado personal",
          institucion: "Universidad",
          periodo: "2026",
        },
      ],
    },
    contacts: {},
    isVip: true,
    connection: "none",
  };
  const markup = ui().profileMarkup(member);
  assert.ok(!markup.includes("<script>"));
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /Información proporcionada por el profesional/);
  assert.ok(!markup.includes("wa.me/"));
  assert.match(markup, /Conectar/);
  const connected = ui().profileMarkup({
    ...member,
    connection: "connected",
    contacts: { email: "member@example.test", web: "javascript:alert(1)" },
  });
  assert.match(connected, /mailto:member@example.test/);
  assert.ok(!connected.includes('href="javascript:'));
  assert.match(connected, /Desconectar/);
});
test("the existing forum publisher retains a failed draft and confirms success only after the server acknowledges", async () => {
  let resolve, reject;
  const api = new Promise((a, b) => {
      resolve = a;
      reject = b;
    }),
    text = { value: "Mi aportación real" },
    button = { innerHTML: "Publicar", dataset: {}, disabled: false },
    preview = { style: { display: "block" } },
    counter = { textContent: "20 / 1500" },
    imageStatus = { textContent: "Imagen lista" },
    events = [];
  const nodes = {
      "#foro-text": text,
      "#foro-publicar": button,
      "#foro-img-preview": preview,
      "#foro-char": counter,
      "#foro-image-status": imageStatus,
    },
    container = { querySelector: (s) => nodes[s] },
    ctx = {
      window: {
        ICADEMPlatform: { createForumPost: () => api },
        ICADEMCommunity: { forumState: () => events.push("state") },
      },
      Toast: {
        success: () => events.push("success"),
        error: () => events.push("error"),
      },
      console: { error: () => {} },
      _foroImg: "data:image/jpeg;base64,test",
    };
  const a = html.indexOf("  async function foroPublicar("),
    b = html.indexOf("  async function foroToggleLike", a);
  vm.runInNewContext(html.slice(a, b), ctx);
  const pending = ctx.foroPublicar(container);
  assert.equal(button.disabled, true);
  assert.ok(!events.includes("success"));
  reject(Error("Sin conexión"));
  await pending;
  assert.equal(text.value, "Mi aportación real");
  assert.equal(preview.style.display, "block");
  assert.ok(events.includes("error"));
  assert.equal(button.disabled, false);
  ctx.window.ICADEMPlatform.createForumPost = async () => ({ ok: true });
  await ctx.foroPublicar(container);
  assert.equal(text.value, "");
  assert.equal(preview.style.display, "none");
  assert.ok(events.includes("success"));
  assert.equal(counter.textContent, "0 / 1500");
});
test("community integration preserves the forum write service, existing filters and real head assets", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  const script=head.match(/src="(js\/icadem-community\.js\?v=\d+)"/);
  assert(script);assert.ok(fs.readFileSync(__dirname+'/../sw.js','utf8').includes('./'+script[1]),'service worker caches the same community asset version');
  assert.match(head, /css\/icadem-community\.css\?v=1/);
  assert.match(html, /createForumPost\(/);
  for (const value of ["recientes", "populares", "mios"])
    assert.ok(html.includes('data-foro-tab="' + value + '"'));
  assert.match(source, /\/api\/community/);
  assert.ok(!source.includes("collection("));
  assert.ok(!source.includes("/messages"));
});
