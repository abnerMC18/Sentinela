import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Faltam as chaves do Supabase no ficheiro .env!");
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log("Ligação ao Supabase configurada com sucesso!");

export default supabase;