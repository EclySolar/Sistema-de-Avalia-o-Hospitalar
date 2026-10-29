require("dotenv").config();
const { checkConnection, pool } = require("../config/database");
checkConnection()
  .then(async () => {
    console.log("Conexão com MySQL OK.");
    await pool.end();
  })
  .catch((e) => {
    console.error("Conexão falhou:", e.message);
    process.exit(1);
  });
