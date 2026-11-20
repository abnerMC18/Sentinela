import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 1. Abre o ficheiro .env e carrega as credenciais para a memória
dotenv.config();

const app = express();

// 2. Configuração de segurança e formato
app.use(cors()); // Permite que o Frontend comunique com esta API
app.use(express.json()); // Ensina o servidor a ler os dados enviados pelo Frontend

// 3. Rota de receção de dados (O que o ApiService do Frontend vai chamar)
app.post('/api/sensores/registro', (req, res) => {
    const dadosDoSensor = req.body;

    // É aqui que usarias o process.env.DB_PASS para guardar na base de dados.
    // Por enquanto, vamos simular a receção:
    console.log('✅ Recebido do Frontend:', dadosDoSensor);
    console.log('🔒 A ligar à base de dados com o utilizador:', process.env.DB_USER);

    // 4. Devolve uma resposta de sucesso ao Frontend
    res.status(201).json({ 
        mensagem: 'Dados encriptados e guardados com sucesso no Back-end!' 
    });
});

// 5. Inicia o servidor na porta definida no .env
const porta = process.env.PORT || 3000;
app.listen(porta, () => {
    console.log(`🚀 Servidor seguro a correr na porta ${porta}`);
});