export default class ApiService {
    #socket;

    constructor(interfaceManager) {
        // Conecta no tubo do servidor
        this.#socket = io('http://localhost:3000');
        
        // Fica a ouvir o evento 'novaLeitura'
        this.#socket.on('novaLeitura', (dadosProcessados) => {
            console.log("⚡ Dado recebido em tempo real!", dadosProcessados);
            
            // Manda atualizar o ecrã e o gráfico instantaneamente
            interfaceManager.atualizarDashboard(dadosProcessados);
            interfaceManager.registrarNoHistorico(dadosProcessados);
        });
    }
}