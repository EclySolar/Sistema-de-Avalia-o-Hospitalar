const r = require("express").Router(),
  bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { requireAuth, roles, hasSector } = require("../middleware/access");
r.use(requireAuth);
const ok = (res, data, message = "Operação realizada com sucesso.") =>
  res.json({ success: true, message, data });
r.get("/sectors", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM sectors";
    let p = [];
    if (req.session.user.role !== "SUPER_ADMIN") {
      sql +=
        " WHERE id IN (SELECT sector_id FROM user_sectors WHERE user_id=?)";
      p = [req.session.user.id];
    }
    const [x] = await pool.execute(sql, p);
    ok(res, x);
  } catch (e) {
    next(e);
  }
});
r.post("/sectors", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { name, slug, description = "" } = req.body;
    if (!name || !/^[a-z0-9-]+$/.test(slug || ""))
      return res
        .status(400)
        .json({
          success: false,
          message: "Nome e slug válido são obrigatórios.",
        });
    const [x] = await pool.execute(
      "INSERT INTO sectors(name,slug,description) VALUES(?,?,?)",
      [name, slug, description],
    );
    ok(res, { id: x.insertId }, "Setor criado.");
  } catch (e) {
    next(e);
  }
});
r.put("/sectors/:id", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { name, slug, description, active } = req.body;
    await pool.execute(
      "UPDATE sectors SET name=?,slug=?,description=?,active=? WHERE id=?",
      [name, slug, description, active ? 1 : 0, req.params.id],
    );
    ok(res, { id: Number(req.params.id) }, "Setor atualizado.");
  } catch (e) {
    next(e);
  }
});
r.get("/categories", async (_q, res, next) => {
  try {
    const [x] = await pool.execute("SELECT * FROM categories ORDER BY name");
    ok(res, x);
  } catch (e) {
    next(e);
  }
});
r.post("/categories", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const [x] = await pool.execute(
      "INSERT INTO categories(name,description) VALUES(?,?)",
      [req.body.name, req.body.description || ""],
    );
    ok(res, { id: x.insertId }, "Categoria criada.");
  } catch (e) {
    next(e);
  }
});
r.get("/questions", async (req, res, next) => {
  try {
    const id = Number(req.query.sectorId);
    if (!(await hasSector(pool, req.session.user, id)))
      return res
        .status(403)
        .json({ success: false, message: "Setor não autorizado." });
    const [x] = await pool.execute(
      "SELECT q.*,c.name category_name FROM questions q JOIN categories c ON c.id=q.category_id WHERE q.sector_id=? ORDER BY display_order",
      [id],
    );
    ok(res, x);
  } catch (e) {
    next(e);
  }
});
r.post(
  "/questions",
  roles("SUPER_ADMIN", "SECTOR_ADMIN"),
  async (req, res, next) => {
    try {
      const b = req.body;
      if (!(await hasSector(pool, req.session.user, b.sectorId)))
        return res
          .status(403)
          .json({ success: false, message: "Setor não autorizado." });
      if (
        !["rating_5", "nps_10", "boolean", "multiple_choice", "text"].includes(
          b.type,
        ) ||
        !b.title
      )
        return res
          .status(400)
          .json({ success: false, message: "Pergunta inválida." });
      const [x] = await pool.execute(
        "INSERT INTO questions(sector_id,category_id,title,description,type,display_order,required,options_json) VALUES(?,?,?,?,?,?,?,?)",
        [
          b.sectorId,
          b.categoryId,
          b.title,
          b.description || "",
          b.type,
          b.displayOrder || 0,
          b.type === "nps_10" ? 1 : 0,
          JSON.stringify(b.options || []),
        ],
      );
      ok(res, { id: x.insertId }, "Pergunta criada.");
    } catch (e) {
      next(e);
    }
  },
);
r.get("/dashboard", async (req, res, next) => {
  try {
    let sql =
      "SELECT s.id,s.name,COUNT(v.id) total,AVG(v.nps_score) avg_nps FROM sectors s LEFT JOIN surveys v ON v.sector_id=s.id";
    let p = [];
    if (req.session.user.role !== "SUPER_ADMIN") {
      sql +=
        " WHERE s.id IN (SELECT sector_id FROM user_sectors WHERE user_id=?)";
      p = [req.session.user.id];
    }
    sql += " GROUP BY s.id,s.name ORDER BY s.name";
    const [x] = await pool.execute(sql, p);
    const total = x.reduce((a, i) => a + Number(i.total), 0);
    ok(res, { totalSurveys: total, sectors: x });
  } catch (e) {
    next(e);
  }
});
r.get("/users", roles("SUPER_ADMIN"), async (_q, res, next) => {
  try {
    const [x] = await pool.execute(
      "SELECT id,name,email,role,active,created_at FROM users",
    );
    ok(res, x);
  } catch (e) {
    next(e);
  }
});
r.post("/users", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const b = req.body;
    if (
      !b.name ||
      !b.email ||
      !b.password ||
      !["SUPER_ADMIN", "SECTOR_ADMIN", "MANAGEMENT"].includes(b.role)
    )
      return res
        .status(400)
        .json({ success: false, message: "Dados de usuário inválidos." });
    const hash = await bcrypt.hash(b.password, 12);
    const [x] = await pool.execute(
      "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
      [b.name, b.email, hash, b.role],
    );
    for (const id of b.sectorIds || [])
      await pool.execute(
        "INSERT IGNORE INTO user_sectors(user_id,sector_id) VALUES(?,?)",
        [x.insertId, id],
      );
    ok(res, { id: x.insertId }, "Usuário criado.");
  } catch (e) {
    next(e);
  }
});
module.exports = r;
