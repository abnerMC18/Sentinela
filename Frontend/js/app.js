import SensorAmbiental from './models/SensorAmbiental.js';
import InterfaceManager from './services/InterfaceManager.js';
import ApiService from './services/ApiService.js';

// Iniciamos os serviços de tela e de comunicação
const interfaceUI = new InterfaceManager();
const api = new ApiService(interfaceUI); 

function simularChegadaDeDados() {
    // Lista de sensores (preparada para receber novos sensores no futuro)
    const sensoresNaEncosta = [
        new SensorAmbiental(Math.random() * 10 + 20, Math.random() * 60 + 20, Math.random() * 10)
    ];

    // Processa todos os sensores da lista
    sensoresNaEncosta.forEach(sensor => {
        const dadosProcessados = sensor.processarLeitura();
        
        interfaceUI.atualizarDashboard(dadosProcessados);
        interfaceUI.registrarNoHistorico(dadosProcessados);
    });
}

// Inicia o ciclo de monitoramento
window.onload = () => {
    simularChegadaDeDados(); 
    setInterval(simularChegadaDeDados, 5000); 
};