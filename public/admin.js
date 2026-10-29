const $ = (s) => document.querySelector(s),
  content = $("#content"),
  notice = $("#notice");
async function api(url, opt = {}) {
  const r = await fetch(url, {
      ...opt,
      headers: { "Content-Type": "application/json", ...(opt.headers || {}) },
    }),
    j = await r.json();
  if (!r.ok) throw Error(j.message);
  return j.data;
}
const msg = (x) => (notice.textContent = x);
async function dashboard() {
  const d = await api("/api/dashboard/summary");
  content.innerHTML = `<div class="cards"><div class="card">Setores ativos<br><strong>${d.activeSectors}</strong></div><div class="card">Avaliações reais<br><strong>${d.totalSurveys}</strong></div><div class="card">NPS geral<br><strong>${d.nps ?? "—"}</strong></div></div><div class="panel"><button onclick="location.href='/admin/setores'">+ Criar setor</button><button onclick="location.href='/admin/usuarios'">+ Criar usuário</button><button onclick="location.href='/admin/pesquisas'">Gerenciar pesquisas</button></div>`;
}
async function sectors() {
  const rows = await api("/api/sectors");
  content.innerHTML = `<button id="new">+ Criar setor</button><div class="panel" id="form" hidden><h2>Novo setor</h2><label>Nome<input id="name"></label><label>Slug<input id="slug"></label><label>Descrição<textarea id="description"></textarea></label><button id="save">Salvar</button></div><table><tr><th>Setor</th><th>Status</th><th>Usuários</th><th>Perguntas</th><th>Avaliações</th><th>Ações</th></tr>${rows.map((s) => `<tr><td>${s.name}<br><small>${s.slug}</small></td><td>${s.active ? "Ativo" : "Inativo"}</td><td>${s.user_count}</td><td>${s.question_count}</td><td>${s.survey_count}</td><td><a href="/admin/setores/${s.id}">Gerenciar</a> · <a target="_blank" href="/pesquisa/${s.slug}">Pesquisa</a></td></tr>`).join("")}</table>`;
  $("#new").onclick = () => ($("#form").hidden = false);
  $("#save").onclick = async () => {
    try {
      await api("/api/sectors", {
        method: "POST",
        body: JSON.stringify({
          name: $("#name").value,
          slug: $("#slug").value,
          description: $("#description").value,
        }),
      });
      msg("Setor criado.");
      sectors();
    } catch (e) {
      msg(e.message);
    }
  };
}
async function users() {
  const [users, sectors] = await Promise.all([
    api("/api/users"),
    api("/api/sectors"),
  ]);
  content.innerHTML = `<button id="new">+ Criar usuário</button><div class="panel" id="form" hidden><h2>Novo usuário</h2><input id="name" placeholder="Nome"><input id="email" placeholder="E-mail"><input id="password" type="password" placeholder="Senha inicial"><select id="role"><option value="SECTOR_ADMIN">Admin de Setor</option><option value="MANAGEMENT">Gestão</option><option value="SUPER_ADMIN">Super Admin</option></select><label>Setores<select id="sector" multiple>${sectors.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select></label><button id="save">Salvar</button></div><table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Setores</th><th>Status</th></tr>${users.map((u) => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.sectors || "Todos"}</td><td>${u.active ? "Ativo" : "Inativo"}</td></tr>`).join("")}</table>`;
  $("#new").onclick = () => ($("#form").hidden = false);
  $("#save").onclick = async () => {
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: $("#name").value,
          email: $("#email").value,
          password: $("#password").value,
          role: $("#role").value,
          sectorIds: [...$("#sector").selectedOptions].map((x) => +x.value),
        }),
      });
      msg("Usuário criado.");
      users();
    } catch (e) {
      msg(e.message);
    }
  };
}
async function sectorPage(id) {
  const [s, qs, cats] = await Promise.all([
    api("/api/sectors/" + id),
    api("/api/sectors/" + id + "/questions"),
    api("/api/admin/categories"),
  ]);
  content.innerHTML = `<div class="panel"><h2>${s.name}</h2><p>${s.description || ""}</p><p>${s.user_count} usuários · ${s.question_count} perguntas · ${s.survey_count} avaliações · NPS ${s.nps ?? "—"}</p><a target="_blank" href="/pesquisa/${s.slug}">Abrir pesquisa pública</a></div><div class="panel"><h2>Perguntas deste setor</h2><button id="new">+ Nova pergunta</button><div id="form" hidden><input id="question" placeholder="Texto da pergunta"><select id="type"><option value="rating_5">Avaliação 1–5</option><option value="boolean">Sim/Não</option><option value="multiple_choice">Múltipla escolha</option><option value="text">Texto</option><option value="nps_10">NPS 0–10</option></select><select id="category">${cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select><input id="options" placeholder="Alternativas separadas por vírgula"><button id="save">Salvar pergunta</button></div>${qs.map((q) => `<p>${q.display_order}. ${q.title} — ${q.type} ${q.active ? "" : "(inativa)"}</p>`).join("") || "<p>Nenhuma pergunta.</p>"}</div>`;
  $("#new").onclick = () => ($("#form").hidden = false);
  $("#save").onclick = async () => {
    try {
      let type = $("#type").value;
      await api("/api/sectors/" + id + "/questions", {
        method: "POST",
        body: JSON.stringify({
          title: $("#question").value,
          type,
          categoryId: +$("#category").value,
          options: ["boolean"].includes(type)
            ? ["Sim", "Não"]
            : $("#options")
                .value.split(",")
                .map((x) => x.trim())
                .filter(Boolean),
          displayOrder: qs.length + 1,
        }),
      });
      msg("Pergunta criada.");
      sectorPage(id);
    } catch (e) {
      msg(e.message);
    }
  };
}
(async () => {
  try {
    const me = await api("/api/auth/me");
    $("#role").textContent = me.user.role;
    document.querySelectorAll("[data-super]").forEach((x) => {
      if (me.user.role !== "SUPER_ADMIN") x.remove();
    });
    const p = location.pathname;
    if (p === "/admin/setores") sectors();
    else if (p === "/admin/usuarios") users();
    else if (/^\/admin\/setores\/\d+$/.test(p)) sectorPage(p.split("/").pop());
    else if (p === "/admin/pesquisas") sectors();
    else dashboard();
  } catch (_) {
    location.href = "/login";
  }
})();
$("#logout").onclick = async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/login";
};
