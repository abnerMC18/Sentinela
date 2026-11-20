export default class InterfaceManager {
    #historicoDeDados;
    #graficoSensores;

    constructor() {
        this.#historicoDeDados = [];
        this.#iniciarGrafico();
        this.#configurarBotoes();
    }

    #configurarBotoes() {
        document.getElementById('btn-dashboard').addEventListener('click', () => this.#mudarAba('dashboard'));
        document.getElementById('btn-history').addEventListener('click', () => this.#mudarAba('history'));
    }

    #mudarAba(tabName) {
        const tabDash = document.getElementById('tab-dashboard');
        const tabHist = document.getElementById('tab-history');
        const btnDash = document.getElementById('btn-dashboard');
        const btnHist = document.getElementById('btn-history');

        const activeClass = "bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]".split(" ");
        const inactiveClass = "bg-gray-700 text-gray-400 hover:bg-gray-600".split(" ");

        if (tabName === 'dashboard') {
            tabDash.classList.remove('hidden'); tabHist.classList.add('hidden');
            btnDash.classList.remove(...inactiveClass); btnDash.classList.add(...activeClass);
            btnHist.classList.remove(...activeClass); btnHist.classList.add(...inactiveClass);
        } else {
            tabDash.classList.add('hidden'); tabHist.classList.remove('hidden');
            btnHist.classList.remove(...inactiveClass); btnHist.classList.add(...activeClass);
            btnDash.classList.remove(...activeClass); btnDash.classList.add(...inactiveClass);
        }
    }

    #iniciarGrafico() {
        const ctx = document.getElementById('sensorChart').getContext('2d');
        Chart.defaults.color = '#9CA3AF';
        Chart.defaults.borderColor = '#374151';

        this.#graficoSensores = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Temp (°C)', data: [], borderColor: '#60A5FA', backgroundColor: 'rgba(96, 165, 250, 0.1)', borderWidth: 2, tension: 0.4, fill: true },
                    { label: 'Umid (%)', data: [], borderColor: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.1)', borderWidth: 2, tension: 0.4, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    atualizarDashboard(dados) {
        document.getElementById('val-temp').innerText = dados.temperatura;
        document.getElementById('val-umidade').innerText = dados.umidadeSolo;
        
        const cardRisco = document.getElementById('card-risco');
        const valRisco = document.getElementById('val-risco');

        if (dados.risco === 'ALTO') {
            cardRisco.className = "bg-red-900/50 p-6 rounded-xl border border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] relative overflow-hidden transition-colors duration-500 mt-0";
            valRisco.className = "text-4xl font-bold text-red-400 animate-pulse-fast";
            valRisco.innerText = "ALTO";
        } else {
            cardRisco.className = "bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl relative overflow-hidden transition-colors duration-500 mt-0";
            valRisco.className = "text-4xl font-bold text-green-400";
            valRisco.innerText = "NORMAL";
        }

        this.#graficoSensores.data.labels.push(dados.horario);
        this.#graficoSensores.data.datasets[0].data.push(dados.temperatura);
        this.#graficoSensores.data.datasets[1].data.push(dados.umidadeSolo);

        if (this.#graficoSensores.data.labels.length > 10) {
            this.#graficoSensores.data.labels.shift();
            this.#graficoSensores.data.datasets[0].data.shift();
            this.#graficoSensores.data.datasets[1].data.shift();
        }
        this.#graficoSensores.update();
    }

    registrarNoHistorico(dados) {
        this.#historicoDeDados.unshift(dados);
        if (this.#historicoDeDados.length > 50) this.#historicoDeDados.pop();

        const tbody = document.getElementById('history-tbody');
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-750 transition-colors";
        
        const badgeClass = dados.risco === 'ALTO' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400';

        tr.innerHTML = `
            <td class="px-6 py-4 text-gray-300">${dados.horario}</td>
            <td class="px-6 py-4 text-gray-300">${dados.temperatura} °C</td>
            <td class="px-6 py-4 text-gray-300">${dados.umidadeSolo}%</td>
            <td class="px-6 py-4 text-gray-300">${dados.nivelChuva} mm</td>
            <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs font-bold ${badgeClass}">${dados.risco}</span></td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
    }
}