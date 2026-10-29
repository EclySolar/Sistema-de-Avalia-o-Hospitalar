const msg = document.querySelector("#message"),
  form = document.querySelector("#form");
async function api(u, o = {}) {
  const r = await fetch(u, {
    ...o,
    headers: { "Content-Type": "application/json", ...(o.headers || {}) },
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.message);
  return j;
}
async function dashboard() {
  const d = await api("/api/admin/dashboard");
  document.querySelector("#stats").innerHTML =
    `<p>${d.data.totalSurveys} avaliações recebidas</p>` +
    d.data.sectors
      .map(
        (s) =>
          `<p>${s.name}: ${s.total} respostas | NPS médio: ${s.avg_nps ?? "—"}</p>`,
      )
      .join("");
}
form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const x = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    document.querySelector("#user").textContent = `Olá, ${x.data.user.name}`;
    form.parentElement.hidden = true;
    document.querySelector("#panel").hidden = false;
    dashboard();
  } catch (e) {
    msg.textContent = e.message;
  }
};
document.querySelector("#logout").onclick = async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.reload();
};
