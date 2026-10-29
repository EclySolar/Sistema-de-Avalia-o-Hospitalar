require("dotenv").config();
const express = require("express"),
  session = require("express-session"),
  helmet = require("helmet"),
  rateLimit = require("express-rate-limit"),
  path = require("path");
const { pool, checkConnection } = require("./config/database");
const authRoutes = require("./routes/authRoutes"),
  adminRoutes = require("./routes/adminRoutes"),
  publicRoutes = require("./routes/publicRoutes"),
  testRoutes = require("./routes/testRoutes"),
  coreRoutes = require("./routes/coreRoutes");
const { errorHandler } = require("./middleware/errorHandler");
const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defina-uma-chave-segura-no-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 28800000,
    },
  }),
);
app.use("/api/auth/login", rateLimit({ windowMs: 900000, limit: 10 }));
app.use("/assets", express.static(path.join(__dirname, "public")));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/testes", testRoutes);
app.use("/api", coreRoutes);
app.use("/api/public", publicRoutes);
app.get("/api/health/database", async (_q, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, data: { database: "available" } });
  } catch (_) {
    res
      .status(503)
      .json({ success: false, message: "Banco de dados indisponível." });
  }
});
app.get("/pesquisa/:slug", (_q, res) =>
  res.sendFile(path.join(__dirname, "views", "survey.html")),
);
app.get("/login", (_q, res) =>
  res.sendFile(path.join(__dirname, "views", "index.html")),
);
app.get(
  [
    "/admin",
    "/admin/setores",
    "/admin/usuarios",
    "/admin/pesquisas",
    "/admin/setores/:id",
  ],
  (_q, res) => res.sendFile(path.join(__dirname, "views", "admin.html")),
);
app.get("/admin/testes", (_q, res) =>
  res.sendFile(path.join(__dirname, "views", "tests.html")),
);
app.get("*splat", (req, res) =>
  req.path.startsWith("/api/")
    ? res.status(404).json({ success: false, message: "Rota não encontrada." })
    : res.sendFile(path.join(__dirname, "views", "index.html")),
);
app.use(errorHandler);
if (require.main === module)
  checkConnection()
    .then(() =>
      app.listen(process.env.PORT || 3000, () =>
        console.log(`Servidor em http://localhost:${process.env.PORT || 3000}`),
      ),
    )
    .catch(() => {
      console.error("Não foi possível conectar ao MySQL. Verifique o .env.");
      process.exit(1);
    });
module.exports = app;
