import express from "express";
import cors from "cors";
import supabase from "./config/supabaseClient.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações base do servidor
app.use(cors()); // Permite que futuros sites (Frontend) acedam a esta API
app.use(express.json()); // Diz ao servidor para entender dados no formato JSON (o que a ESP32 vai enviar)

// Rota de receção de dados da ESP32
app.post("/api/leituras", async (req, res) => {
  try {
    const { sensor_id, tipo_sensor, valor } = req.body;

    // Inserir os dados recebidos no Supabase
    const { data, error } = await supabase
      .from("leituras")
      .insert([{ sensor_id, tipo_sensor, valor }]);

    if (error) throw error;

    console.log(
      `✅ Nova leitura recebida e guardada: ${sensor_id} -> ${valor}`,
    );
    res.status(201).json({ message: "Dados guardados com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao guardar leitura:", error.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}); // Rota para enviar os dados para o Frontend (Dashboard)
app.get("/api/leituras", async (req, res) => {
  try {
    // Vai buscar as últimas 10 leituras, da mais recente para a mais antiga
    const { data, error } = await supabase
      .from("leituras")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // Envia os dados encontrados para a página web
    res.status(200).json(data);
  } catch (error) {
    console.error("❌ Erro ao buscar leituras:", error.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Sentinela das Encostas a correr na porta ${PORT}`);
});
