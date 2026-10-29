require("dotenv").config();
const { pool } = require("../config/database");
const slug = "teste-funcionalidade";
const rows = [
  [
    "Atendimento",
    "Como você avalia o atendimento recebido?",
    "rating_5",
    1,
    0,
    [],
  ],
  [
    "Atendimento",
    "Você recebeu as informações necessárias durante o atendimento?",
    "boolean",
    2,
    0,
    ["Sim", "Não"],
  ],
  [
    "Tempo de Espera",
    "Como você considera o tempo de espera?",
    "multiple_choice",
    3,
    0,
    ["Muito rápido", "Rápido", "Aceitável", "Demorado", "Muito demorado"],
  ],
  [
    "Atendimento",
    "O que poderíamos melhorar em nosso atendimento?",
    "text",
    4,
    0,
    [],
  ],
  [
    "Estrutura",
    "Como você avalia a limpeza e a organização do ambiente?",
    "rating_5",
    5,
    0,
    [],
  ],
  [
    "NPS",
    "De 0 a 10, o quanto você recomendaria nosso atendimento a outra pessoa?",
    "nps_10",
    6,
    1,
    [],
  ],
];
(async () => {
  await pool.execute(
    "INSERT INTO sectors(name,slug,description,active) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),active=1",
    ["Setor de Testes — FHDOD", slug, "AMBIENTE DE TESTES — DADOS FICTÍCIOS"],
  );
  for (const n of ["Atendimento", "Tempo de Espera", "Estrutura", "NPS"])
    await pool.execute("INSERT IGNORE INTO categories(name) VALUES(?)", [n]);
  const [s] = await pool.execute("SELECT id FROM sectors WHERE slug=?", [slug]);
  for (const [cat, title, type, order, required, options] of rows) {
    const [c] = await pool.execute("SELECT id FROM categories WHERE name=?", [
      cat,
    ]);
    await pool.execute(
      "INSERT INTO questions(sector_id,category_id,title,type,display_order,required,active,options_json) VALUES(?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE category_id=VALUES(category_id),type=VALUES(type),display_order=VALUES(display_order),required=VALUES(required),active=1,options_json=VALUES(options_json)",
      [s[0].id, c[0].id, title, type, order, required, JSON.stringify(options)],
    );
    const [q] = await pool.execute(
      "SELECT id FROM questions WHERE sector_id=? AND title=?",
      [s[0].id, title],
    );
    for (let i = 0; i < options.length; i++)
      await pool.execute(
        "INSERT IGNORE INTO question_options(question_id,label,value,display_order) VALUES(?,?,?,?)",
        [q[0].id, options[i], options[i], i + 1],
      );
  }
  console.log("Setor e seis perguntas de teste preparados.");
  await pool.end();
})().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
