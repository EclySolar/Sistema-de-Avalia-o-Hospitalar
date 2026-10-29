require("dotenv").config();
const { pool } = require("../config/database");
(async () => {
  for (const n of [
    "Pronto Atendimento",
    "Internação",
    "Bloco Cirúrgico",
    "Saúde Mental",
    "Endoscopia",
    "Raio-X",
  ])
    await pool.execute("INSERT IGNORE INTO sectors(name,slug) VALUES(?,?)", [
      n,
      n
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "-"),
    ]);
  for (const n of [
    "Recepção",
    "Triagem",
    "Enfermagem",
    "Médico",
    "Atendimento",
    "Higiene",
    "Estrutura",
    "Tempo de Espera",
    "NPS",
  ])
    await pool.execute("INSERT IGNORE INTO categories(name) VALUES(?)", [n]);
  console.log("Dados demonstrativos inseridos.");
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
