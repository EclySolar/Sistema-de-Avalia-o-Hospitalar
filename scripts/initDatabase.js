require("dotenv").config();
const mysql = require("mysql2/promise");
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await c.query(
    "CREATE DATABASE IF NOT EXISTS sistema_hospitalar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await c.end();
  console.log("Banco preparado.");
})().catch((e) => {
  console.error("Falha ao preparar banco:", e.message);
  process.exit(1);
});
