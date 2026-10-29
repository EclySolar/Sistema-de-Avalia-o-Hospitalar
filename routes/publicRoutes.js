const r = require("express").Router();
const { pool } = require("../config/database");
const opts = (x) =>
  Buffer.isBuffer(x)
    ? JSON.parse(x.toString())
    : typeof x === "string"
      ? JSON.parse(x || "[]")
      : x || [];
async function sector(slug) {
  const [x] = await pool.execute(
    "SELECT id,name,description FROM sectors WHERE slug=? AND active=1",
    [slug],
  );
  return x[0];
}
async function details(req, res, next) {
  try {
    const s = await sector(req.params.slug);
    if (!s)
      return res
        .status(404)
        .json({ success: false, message: "Setor não encontrado." });
    const [q] = await pool.execute(
      "SELECT id,title,description,type,required,options_json FROM questions WHERE sector_id=? AND active=1 ORDER BY display_order",
      [s.id],
    );
    res.json({
      success: true,
      data: {
        sector: s,
        questions: q.map((x) => ({ ...x, options: opts(x.options_json) })),
      },
    });
  } catch (e) {
    next(e);
  }
}
r.get("/sectors/:slug", details);
r.get("/sectors/:slug/questions", details);
r.post("/surveys/:slug", async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const s = await sector(req.params.slug),
      b = req.body;
    if (!s)
      return res
        .status(404)
        .json({ success: false, message: "Setor não encontrado." });
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.attendanceDate || "") ||
      !["morning", "afternoon", "night"].includes(b.shift) ||
      !Array.isArray(b.answers)
    )
      return res
        .status(400)
        .json({ success: false, message: "Dados de atendimento inválidos." });
    const [q] = await c.execute(
      "SELECT id,type,required,options_json FROM questions WHERE sector_id=? AND active=1",
      [s.id],
    );
    const map = new Map(q.map((x) => [x.id, x]));
    let nps;
    for (const a of b.answers) {
      const x = map.get(a.questionId);
      if (!x) throw Object.assign(Error("Pergunta inválida."), { status: 400 });
      if (
        ["nps_10", "rating_5"].includes(x.type) &&
        (!Number.isInteger(a.value) ||
          a.value < (x.type === "nps_10" ? 0 : 1) ||
          a.value > (x.type === "nps_10" ? 10 : 5))
      )
        throw Object.assign(Error("Nota inválida."), { status: 400 });
      if (
        x.type === "text" &&
        typeof a.value === "string" &&
        a.value.length > 1000
      )
        throw Object.assign(Error("Texto excede 1000 caracteres."), {
          status: 400,
        });
      if (
        ["boolean", "multiple_choice"].includes(x.type) &&
        !opts(x.options_json).includes(a.value)
      )
        throw Object.assign(Error("Alternativa inválida."), { status: 400 });
      if (x.type === "nps_10") nps = a.value;
    }
    if (!Number.isInteger(nps))
      return res
        .status(400)
        .json({ success: false, message: "A pergunta NPS é obrigatória." });
    for (const x of q.filter((x) => x.required))
      if (!b.answers.some((a) => a.questionId === x.id))
        return res
          .status(400)
          .json({ success: false, message: "Resposta obrigatória ausente." });
    await c.beginTransaction();
    const [v] = await c.execute(
      "INSERT INTO surveys(sector_id,attendance_date,attendance_shift,nps_score,is_demo) VALUES(?,?,?,?,?)",
      [
        s.id,
        b.attendanceDate,
        b.shift,
        nps,
        req.params.slug === "teste-funcionalidade",
      ],
    );
    for (const a of b.answers)
      await c.execute(
        "INSERT INTO survey_answers(survey_id,question_id,answer_value) VALUES(?,?,?)",
        [v.insertId, a.questionId, String(a.value)],
      );
    await c.commit();
    res
      .status(201)
      .json({
        success: true,
        message: "Avaliação enviada. Obrigado!",
        data: { id: v.insertId },
      });
  } catch (e) {
    await c.rollback();
    next(e);
  } finally {
    c.release();
  }
});
module.exports = r;
