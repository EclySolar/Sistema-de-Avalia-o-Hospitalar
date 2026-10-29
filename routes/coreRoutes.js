const r = require("express").Router(),
  bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { requireAuth, roles, hasSector } = require("../middleware/access");
r.use(requireAuth);
const send = (res, data, message = "Operação realizada com sucesso.") =>
  res.json({ success: true, message, data });
const can = async (req, id) => hasSector(pool, req.session.user, Number(id));
r.get("/sectors", async (req, res, next) => {
  try {
    let where = "",
      p = [];
    if (req.session.user.role !== "SUPER_ADMIN") {
      where =
        "WHERE s.id IN (SELECT sector_id FROM user_sectors WHERE user_id=?)";
      p = [req.session.user.id];
    }
    const [x] = await pool.execute(
      `SELECT s.*,COUNT(DISTINCT us.user_id) user_count,COUNT(DISTINCT q.id) question_count,COUNT(DISTINCT v.id) survey_count FROM sectors s LEFT JOIN user_sectors us ON us.sector_id=s.id LEFT JOIN questions q ON q.sector_id=s.id AND q.active=1 LEFT JOIN surveys v ON v.sector_id=s.id ${where} GROUP BY s.id ORDER BY s.name`,
      p,
    );
    send(res, x);
  } catch (e) {
    next(e);
  }
});
r.post("/sectors", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name || !/^[a-z0-9-]+$/.test(b.slug || ""))
      return res
        .status(400)
        .json({
          success: false,
          message: "Nome e slug válido são obrigatórios.",
        });
    const [x] = await pool.execute(
      "INSERT INTO sectors(name,slug,description,active) VALUES(?,?,?,?)",
      [b.name, b.slug, b.description || "", b.active === false ? 0 : 1],
    );
    send(res, { id: x.insertId }, "Setor criado.");
  } catch (e) {
    next(e);
  }
});
r.get("/sectors/:id", async (req, res, next) => {
  try {
    if (!(await can(req, req.params.id)))
      return res
        .status(403)
        .json({ success: false, message: "Setor não autorizado." });
    const [x] = await pool.execute(
      "SELECT s.*,COUNT(DISTINCT us.user_id) user_count,COUNT(DISTINCT q.id) question_count,COUNT(DISTINCT v.id) survey_count,COALESCE(ROUND(100*(SUM(v.nps_score>=9)-SUM(v.nps_score<=6))/NULLIF(COUNT(v.id),0),1),NULL) nps FROM sectors s LEFT JOIN user_sectors us ON us.sector_id=s.id LEFT JOIN questions q ON q.sector_id=s.id AND q.active=1 LEFT JOIN surveys v ON v.sector_id=s.id WHERE s.id=? GROUP BY s.id",
      [req.params.id],
    );
    if (!x[0])
      return res
        .status(404)
        .json({ success: false, message: "Setor não encontrado." });
    send(res, x[0]);
  } catch (e) {
    next(e);
  }
});
r.put("/sectors/:id", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const b = req.body;
    await pool.execute(
      "UPDATE sectors SET name=?,slug=?,description=?,active=? WHERE id=?",
      [b.name, b.slug, b.description || "", b.active ? 1 : 0, req.params.id],
    );
    send(res, { id: Number(req.params.id) }, "Setor atualizado.");
  } catch (e) {
    next(e);
  }
});
r.patch("/sectors/:id/status", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    await pool.execute("UPDATE sectors SET active=? WHERE id=?", [
      req.body.active ? 1 : 0,
      req.params.id,
    ]);
    send(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});
r.get("/sectors/:id/users", async (req, res, next) => {
  try {
    if (!(await can(req, req.params.id)))
      return res
        .status(403)
        .json({ success: false, message: "Setor não autorizado." });
    const [x] = await pool.execute(
      "SELECT u.id,u.name,u.email,u.role,u.active FROM users u JOIN user_sectors us ON us.user_id=u.id WHERE us.sector_id=?",
      [req.params.id],
    );
    send(res, x);
  } catch (e) {
    next(e);
  }
});
r.post("/sectors/:id/users", roles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    await pool.execute(
      "INSERT IGNORE INTO user_sectors(user_id,sector_id) VALUES(?,?)",
      [req.body.userId, req.params.id],
    );
    send(res, null, "Usuário vinculado.");
  } catch (e) {
    next(e);
  }
});
r.delete(
  "/sectors/:id/users/:userId",
  roles("SUPER_ADMIN"),
  async (req, res, next) => {
    try {
      await pool.execute(
        "DELETE FROM user_sectors WHERE user_id=? AND sector_id=?",
        [req.params.userId, req.params.id],
      );
      send(res, null, "Vínculo removido.");
    } catch (e) {
      next(e);
    }
  },
);
r.get("/sectors/:id/questions", async (req, res, next) => {
  try {
    if (!(await can(req, req.params.id)))
      return res
        .status(403)
        .json({ success: false, message: "Setor não autorizado." });
    const [x] = await pool.execute(
      "SELECT q.*,c.name category_name FROM questions q JOIN categories c ON c.id=q.category_id WHERE q.sector_id=? ORDER BY q.display_order",
      [req.params.id],
    );
    send(res, x);
  } catch (e) {
    next(e);
  }
});
r.post(
  "/sectors/:id/questions",
  roles("SUPER_ADMIN", "SECTOR_ADMIN"),
  async (req, res, next) => {
    try {
      if (!(await can(req, req.params.id)))
        return res
          .status(403)
          .json({ success: false, message: "Setor não autorizado." });
      const b = req.body;
      if (
        !b.title ||
        !b.categoryId ||
        !["rating_5", "nps_10", "boolean", "multiple_choice", "text"].includes(
          b.type,
        )
      )
        return res
          .status(400)
          .json({ success: false, message: "Dados da pergunta inválidos." });
      const [x] = await pool.execute(
        "INSERT INTO questions(sector_id,category_id,title,description,type,display_order,required,active,options_json) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          req.params.id,
          b.categoryId,
          b.title,
          b.description || "",
          b.type,
          b.displayOrder || 0,
          b.type === "nps_10" ? 1 : 0,
          b.active === false ? 0 : 1,
          JSON.stringify(b.options || []),
        ],
      );
      send(res, { id: x.insertId }, "Pergunta criada.");
    } catch (e) {
      next(e);
    }
  },
);
r.get("/users", roles("SUPER_ADMIN"), async (_q, res, next) => {
  try {
    const [x] = await pool.query(
      "SELECT u.id,u.name,u.email,u.role,u.active,GROUP_CONCAT(s.name SEPARATOR ' | ') sectors FROM users u LEFT JOIN user_sectors us ON us.user_id=u.id LEFT JOIN sectors s ON s.id=us.sector_id GROUP BY u.id ORDER BY u.name",
    );
    send(res, x);
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
        .json({ success: false, message: "Dados inválidos." });
    if (b.role !== "SUPER_ADMIN" && !(b.sectorIds || []).length)
      return res
        .status(400)
        .json({
          success: false,
          message: "Informe ao menos um setor autorizado.",
        });
    const [x] = await pool.execute(
      "INSERT INTO users(name,email,password_hash,role,active) VALUES(?,?,?,?,?)",
      [
        b.name,
        b.email,
        await bcrypt.hash(b.password, 12),
        b.role,
        b.active === false ? 0 : 1,
      ],
    );
    for (const id of b.sectorIds || [])
      await pool.execute(
        "INSERT IGNORE INTO user_sectors(user_id,sector_id) VALUES(?,?)",
        [x.insertId, id],
      );
    send(res, { id: x.insertId }, "Usuário criado.");
  } catch (e) {
    next(e);
  }
});
r.get("/dashboard/summary", async (req, res, next) => {
  try {
    let condition = "WHERE is_demo=0",
      p = [];
    if (req.session.user.role !== "SUPER_ADMIN") {
      condition +=
        " AND sector_id IN (SELECT sector_id FROM user_sectors WHERE user_id=?)";
      p = [req.session.user.id];
    }
    const [[a]] = await pool.execute(
      `SELECT COUNT(*) surveys,COALESCE(ROUND(100*(SUM(nps_score>=9)-SUM(nps_score<=6))/NULLIF(COUNT(*),0),1),NULL) nps FROM surveys ${condition}`,
      p,
    );
    const [[s]] = await pool.execute(
      req.session.user.role === "SUPER_ADMIN"
        ? "SELECT COUNT(*) total FROM sectors WHERE active=1"
        : "SELECT COUNT(*) total FROM user_sectors WHERE user_id=?",
      [...p],
    );
    send(res, { activeSectors: s.total, totalSurveys: a.surveys, nps: a.nps });
  } catch (e) {
    next(e);
  }
});
module.exports = r;
