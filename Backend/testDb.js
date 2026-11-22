import supabase from './config/supabaseClient.js';

async function testarInsercao() {
    console.log("A tentar inserir um dado fictício no Supabase...");

    const { data, error } = await supabase
        .from('leituras')
        .insert([
            { 
                sensor_id: 'esp32_teste_01', 
                tipo_sensor: 'umidade_solo', 
                valor: 45.5 
            }
        ]);

    if (error) {
        console.error("❌ Erro ao inserir na base de dados:", error.message);
    } else {
        console.log("✅ Sucesso! O dado foi inserido na base de dados com sucesso.");
    }
}

testarInsercao();