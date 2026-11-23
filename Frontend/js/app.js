/* =====================================================================
   SENTINELA DAS ENCOSTAS · Comando Central Unificado
   Conecta ao server_ia.py (WebSocket /ws + REST /api/*) + Mapa Esri
   ===================================================================== */
const BACKEND_HOST = 'localhost:8000';
const WS_URL = `ws://${BACKEND_HOST}/ws`;
const API_BASE = `http://${BACKEND_HOST}`;

const NIVEIS = [
    { nome: 'ESTÁVEL', curto: 'N0', classe: 'seguro' },
    { nome: 'ATENÇÃO', curto: 'N1', classe: 'atencao' },
    { nome: 'PRÉ-RUPTURA', curto: 'N2', classe: 'perigo' },
    { nome: 'RUPTURA', curto: 'N3', classe: 'perigo' }
];

let graficoSensores;
let mapa;
let marcadores = {};
let coordsBase = [-8.047562, -34.877002];

let ws = null;
let wsConectado = false;
let estadoServidor = null;
let ultimaAvaliacao = {};
let leiturasSQLite = [];
let alertasSQLite = [];
let historicoSimulado = [];

function fmt(v, d, u) {
    if (v === null || v === undefined || isNaN(Number(v))) return '--';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + (u || '');
}

function horaFormatada(ts) {
    try {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('pt-BR', { hour12: false });
    } catch { return '--:--'; }
}

// =====================================================================
// 1. MAPA TÁTICO (ESRI DARK GRAY) & GRÁFICO (CHART.JS)
// =====================================================================
function iniciarMapa() {
    mapa = L.map('mapa-sentinelas').setView(coordsBase, 15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16, attribution: 'Tiles &copy; Esri'
    }).addTo(mapa);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
    }).addTo(mapa);

    mapa.locate({ setView: true, maxZoom: 14 });
    mapa.on('locationfound', function (e) {
        coordsBase = [e.latlng.lat, e.latlng.lng];
        L.circleMarker(e.latlng, {
            radius: 7, fillColor: "#ffffff", color: "#4299e1", weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(mapa).bindPopup("<b>📍 Base de Comando (Gateway LoRa USB)</b>").openPopup();
    });
}

function iniciarGrafico() {
    const ctx = document.getElementById('graficoSensores').getContext('2d');
    graficoSensores = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Umidade (%)', data: [], borderColor: '#4299e1', backgroundColor: 'rgba(66,153,225,0.15)', fill: true, tension: 0.35, yAxisID: 'y' },
                { label: 'Índice de Risco IA (%)', data: [], borderColor: '#f85149', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.35, yAxisID: 'y' },
                { label: 'Inclinação (°)', data: [], borderColor: '#d29922', backgroundColor: 'transparent', tension: 0.35, yAxisID: 'y1' }
            ]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', beginAtZero: true, max: 100, grid: { color: '#2d3342' }, ticks: { color: '#8b949e' } },
                y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { color: '#d29922' } },
                x: { grid: { color: '#2d3342' }, ticks: { color: '#8b949e' } }
            },
            plugins: { legend: { labels: { color: '#c9d1d9' } } }
        }
    });
}

// =====================================================================
// 2. CONEXÃO WEBSOCKET + REST COM O SERVER_IA.PY
// =====================================================================
function conectarWebSocket() {
    try {
        ws = new WebSocket(WS_URL);
    } catch {
        agendarReconexao();
        return;
    }

    ws.onopen = () => {
        wsConectado = true;
        buscarTabelasPython();
    };

    ws.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            if (msg.tipo === 'estado') {
                estadoServidor = msg;
                if (Array.isArray(msg.estacoes)) {
                    msg.estacoes.forEach(s => {
                        if (s.ultima) ultimaAvaliacao[s.estacao_id] = s.ultima;
                    });
                }
                renderizarTudo();
            } else if (msg.tipo === 'leitura') {
                ultimaAvaliacao[msg.estacao_id] = msg;
                leiturasSQLite.unshift(msg);
                if (leiturasSQLite.length > 90) leiturasSQLite.length = 90;
                renderizarTudo();
            } else if (msg.tipo === 'alerta' || msg.tipo === 'evento') {
                buscarTabelasPython();
            }
        } catch (e) {
            console.error('Erro ao ler mensagem WS:', e);
        }
    };

    ws.onclose = () => {
        wsConectado = false;
        agendarReconexao();
    };

    ws.onerror = () => {
        try { ws.close(); } catch { }
    };
}

function agendarReconexao() {
    setTimeout(conectarWebSocket, 3000);
}

async function buscarTabelasPython() {
    if (!wsConectado) return;
    try {
        const [resL, resA] = await Promise.all([
            fetch(`${API_BASE}/api/leituras?limite=40&escopo=sessao`, { cache: 'no-store' }),
            fetch(`${API_BASE}/api/alertas?limite=20`, { cache: 'no-store' })
        ]);
        if (resL.ok) {
            const dL = await resL.json();
            leiturasSQLite = dL.leituras || [];
        }
        if (resA.ok) {
            const dA = await resA.json();
            alertasSQLite = dA.alertas || [];
        }
        renderizarTudo();
    } catch { }
}

// =====================================================================
// 3. SIMULADOR DE CONTINGÊNCIA (CASO SERVER_IA.PY ESTEJA DESLIGADO)
// =====================================================================
function gerarSimulacaoLocal() {
    const t = Date.now() / 8000;
    const agora = new Date().toISOString();
    const umi = 48.2 + Math.sin(t) * 9;
    const inc = 0.45 + Math.abs(Math.sin(t * 0.6)) * 1.3;
    const vib = 12.5 + Math.random() * 14;
    const risco = Math.min(95, Math.max(5, Math.round(15 + (umi - 45) * 0.7 + inc * 8)));
    const nivel = risco >= 65 ? 2 : (risco >= 35 ? 1 : 0);

    const av01 = {
        estacao_id: "01",
        setor: "Encosta_Norte_A",
        timestamp: agora,
        umidade: umi,
        inclinacao: inc,
        vib_rms: 3.2,
        vib_pico: vib,
        chuva_mm: 2.0,
        rssi: -68,
        snr: 9.5,
        risco_ia_pct: risco,
        nivel_ia: nivel,
        probabilidades: [0.85, 0.11, 0.03, 0.01],
        ruido_ambiental: "inlier",
        xai: {
            motivo_principal: "Saturação do Solo e Inclinação",
            explicacao: "Modo de simulação local (inicie o server_ia.py para telemetria USB real).",
            grupos: [
                { nome: "Saturação do Solo (Umidade)", contribuicao_pp: Math.round((umi - 45) * 0.7) },
                { nome: "Desvio Angular (Inclinação)", contribuicao_pp: Math.round(inc * 8) },
                { nome: "Micro-Vibração Pico", contribuicao_pp: -2 }
            ]
        }
    };

    historicoSimulado.unshift(av01);
    if (historicoSimulado.length > 50) historicoSimulado.length = 50;
    return [av01];
}

// =====================================================================
// 4. RENDERIZAÇÃO DA INTERFACE
// =====================================================================
function renderizarTudo() {
    let listaEstacoes = [];
    let dadosHistorico = [];

    if (wsConectado && estadoServidor) {
        const fonteTxt = estadoServidor.fonte === 'hardware' ? 'ONLINE (USB REAL)' : 'ONLINE (SIM. PYTHON)';
        document.getElementById('val-rede').textContent = fonteTxt;
        document.getElementById('val-rede').style.color = estadoServidor.fonte === 'hardware' ? '#2ea043' : '#58a6ff';

        listaEstacoes = (estadoServidor.estacoes || []).map(s => ({
            ...s,
            av: ultimaAvaliacao[s.estacao_id] || s.ultima || {}
        }));
        dadosHistorico = leiturasSQLite;
    } else {
        document.getElementById('val-rede').textContent = 'MODO LOCAL';
        document.getElementById('val-rede').style.color = '#d29922';
        const sim = gerarSimulacaoLocal();
        listaEstacoes = sim.map(av => ({ estacao_id: av.estacao_id, setor: av.setor, online: true, rssi: av.rssi, snr: av.snr, av }));
        dadosHistorico = historicoSimulado;
    }

    if (!listaEstacoes.length) return;

    // Cartões do Topo e Lista Lateral
    let somaUmid = 0, qtdUmid = 0, onlineCount = 0;
    let piorEst = listaEstacoes[0];
    let piorRisco = -1;

    const contSensores = document.getElementById('lista-sensores');
    contSensores.innerHTML = '';

    listaEstacoes.forEach((item, idx) => {
        const av = item.av || {};
        const nivelIdx = av.nivel_ia != null && NIVEIS[av.nivel_ia] ? av.nivel_ia : 0;
        const infoNivel = NIVEIS[nivelIdx];
        const risco = av.risco_ia_pct != null ? Math.round(av.risco_ia_pct) : 0;

        if (item.online !== false) onlineCount++;
        if (av.umidade != null && !isNaN(av.umidade)) { somaUmid += Number(av.umidade); qtdUmid++; }
        if (risco >= piorRisco) { piorRisco = risco; piorEst = item; }

        const setor = item.setor ? ` - ${item.setor}` : '';
        const statusPill = item.online === false
            ? `<span class="status-pill of">OFFLINE</span>`
            : `<span class="status-pill on">IA: ${risco}%</span>`;

        contSensores.innerHTML += `
            <div class="sensor-item ${infoNivel.classe}">
                <div class="sensor-top">
                    <h4>ESTAÇÃO ${String(item.estacao_id).toUpperCase()}${setor}</h4>
                    ${statusPill}
                </div>
                <div class="sensor-metrics">
                    <div class="metric"><span>Umidade Solo</span><b>${fmt(av.umidade, 1, ' %')}</b></div>
                    <div class="metric"><span>Inclinação</span><b>${fmt(av.inclinacao, 2, ' °')}</b></div>
                    <div class="metric"><span>Vibração RMS/Pico</span><b>${fmt(av.vib_rms, 1, '')}/${fmt(av.vib_pico, 1, ' mg')}</b></div>
                    <div class="metric"><span>Chuva / Sinal</span><b>${fmt(av.chuva_mm, 1, 'mm')} • ${item.rssi ?? '--'}dBm</b></div>
                </div>
            </div>
        `;

        // Pino no Mapa
        const cor = infoNivel.classe === 'perigo' ? '#f85149' : (infoNivel.classe === 'atencao' ? '#d29922' : '#4299e1');
        const popup = `<b>Estação ${item.estacao_id}${setor}</b><br>Risco IA: <b>${risco}% (${infoNivel.nome})</b><br>Umidade: ${fmt(av.umidade, 1, '%')}<br>Inclinação: ${fmt(av.inclinacao, 2, '°')}`;
        if (!marcadores[item.estacao_id]) {
            marcadores[item.estacao_id] = L.circleMarker([coordsBase[0] + (idx + 1) * 0.002, coordsBase[1] + (idx + 1) * 0.002], {
                radius: 9, fillColor: cor, color: '#fff', weight: 2, fillOpacity: 0.9
            }).addTo(mapa).bindPopup(popup);
        } else {
            marcadores[item.estacao_id].setStyle({ fillColor: cor }).setPopupContent(popup);
        }
    });

    const avPior = piorEst.av || {};
    const nivelPior = NIVEIS[avPior.nivel_ia != null && NIVEIS[avPior.nivel_ia] ? avPior.nivel_ia : 0];
    const riscoGlobal = avPior.risco_ia_pct != null ? Math.round(avPior.risco_ia_pct) : 0;

    document.getElementById('sensores-ativos').textContent = `${onlineCount}/${listaEstacoes.length}`;
    document.getElementById('val-umid-media').textContent = qtdUmid ? `${(somaUmid / qtdUmid).toFixed(1)} %` : '-- %';

    const elGlobal = document.getElementById('val-status-global');
    elGlobal.textContent = `${riscoGlobal}% • ${nivelPior.nome}`;
    elGlobal.className = `valor status ${nivelPior.classe}`;

    // Painel XAI (Explicabilidade Real do Python)
    const filtroEl = document.getElementById('ia-filtro-status');
    if (avPior.ruido_ambiental === 'inlier') {
        filtroEl.textContent = 'IsolationForest: Ruído Normal (Neutralizado)';
    } else if (avPior.ruido_ambiental === 'anomalia') {
        filtroEl.textContent = 'IsolationForest: ANOMALIA DE VIBRAÇÃO';
    } else {
        filtroEl.textContent = 'IsolationForest: Aguardando Calibração';
    }

    const xai = avPior.xai || {};
    document.getElementById('ia-explicacao').textContent = xai.explicacao || 'Sem leitura válida dos sensores para explicação.';
    const grupos = Array.isArray(xai.grupos) ? xai.grupos : [];
    document.getElementById('xai-fatores').innerHTML = grupos.length
        ? grupos.map(g => {
            const pp = Number(g.contribuicao_pp) || 0;
            return `<div class="xai-row"><span>${g.nome}</span><span class="xai-pp ${pp >= 0 ? 'pos' : 'neg'}">${pp >= 0 ? '+' : ''}${pp.toFixed(1)} pp</span></div>`;
        }).join('')
        : '<p class="muted-text">Aguardando pacote com sensores ativos.</p>';

    // Probabilidades por Classe (4 classes do Python)
    const probs = Array.isArray(avPior.probabilidades) ? avPior.probabilidades : [1, 0, 0, 0];
    const p0 = Math.round((probs[0] || 0) * 100);
    const p1 = Math.round((probs[1] || 0) * 100);
    const p2 = Math.round((probs[2] || 0) * 100);
    const p3 = Math.round((probs[3] || 0) * 100);
    document.getElementById('ia-probabilidades').innerHTML = `
        <div class="prob-item"><span>Estável</span><div class="bar-bg"><div class="bar-fill seguro" style="width:${p0}%"></div></div><b>${p0}%</b></div>
        <div class="prob-item"><span>Atenção</span><div class="bar-bg"><div class="bar-fill atencao" style="width:${p1}%"></div></div><b>${p1}%</b></div>
        <div class="prob-item"><span>Pré-ruptura</span><div class="bar-bg"><div class="bar-fill alerta" style="width:${p2}%"></div></div><b>${p2}%</b></div>
        <div class="prob-item"><span>Ruptura</span><div class="bar-bg"><div class="bar-fill perigo" style="width:${p3}%"></div></div><b>${p3}%</b></div>
    `;

    // Gráfico Temporal
    const serie = [...dadosHistorico].reverse().slice(-25);
    graficoSensores.data.labels = serie.map(d => horaFormatada(d.timestamp || d.created_at));
    graficoSensores.data.datasets[0].data = serie.map(d => d.umidade);
    graficoSensores.data.datasets[1].data = serie.map(d => d.risco_ia_pct);
    graficoSensores.data.datasets[2].data = serie.map(d => d.inclinacao);
    graficoSensores.update();

    // Aba 2: Tabela de Histórico & Alertas
    document.getElementById('tabela-historico').innerHTML = dadosHistorico.slice(0, 35).map(d => {
        const nv = NIVEIS[d.nivel_ia != null && NIVEIS[d.nivel_ia] ? d.nivel_ia : 0];
        return `
            <tr>
                <td>${horaFormatada(d.timestamp || d.created_at)}</td>
                <td><b>${d.estacao_id || '01'}</b></td>
                <td>${fmt(d.umidade, 1, '%')}</td>
                <td>${fmt(d.inclinacao, 2, '°')}</td>
                <td>${fmt(d.vib_pico, 1, ' mg')}</td>
                <td>${d.rssi ?? '--'} dBm</td>
                <td><span class="badge ${nv.classe}">${d.risco_ia_pct != null ? Math.round(d.risco_ia_pct) + '%' : '--'} • ${nv.nome}</span></td>
            </tr>
        `;
    }).join('');

    if (alertasSQLite.length) {
        document.getElementById('lista-alertas').innerHTML = alertasSQLite.map(a => {
            const nv = NIVEIS[a.nivel_ia != null && NIVEIS[a.nivel_ia] ? a.nivel_ia : 0];
            return `<div class="alerta-item ${nv.classe}"><b>[${horaFormatada(a.timestamp)}] Estação ${a.estacao_id}</b> → <span class="badge ${nv.classe}">${nv.nome} (${fmt(a.risco_ia_pct, 0, '%')})</span><div style="margin-top:4px;color:#8b949e">${a.motivo_principal || ''}</div></div>`;
        }).join('');
    }

    // Aba 3: Contadores do Gateway LoRa
    if (estadoServidor && estadoServidor.gateway) {
        const gw = estadoServidor.gateway;
        document.getElementById('net-validas').textContent = gw.pacotes_validos ?? '--';
        document.getElementById('net-gateway').textContent = estadoServidor.total_registros_sessao ?? '--';
        document.getElementById('net-crc').textContent = gw.crc_erros ?? '0';
        document.getElementById('net-fmt').textContent = gw.formato_erros ?? '0';
        document.getElementById('net-wifi').textContent = gw.wifi_clientes ?? '0';
    }
}

// =====================================================================
// 5. CONTROLES DAS ABAS, OPERADOR (REST) E EXPORTAÇÃO CSV
// =====================================================================
window.mudarAba = function (aba) {
    ['tempo-real', 'historico', 'operador'].forEach((nome, i) => {
        document.getElementById(`aba-${nome}`).style.display = nome === aba ? 'block' : 'none';
        document.querySelectorAll('.tab')[i].classList.toggle('active', nome === aba);
    });
    if (aba === 'tempo-real' && mapa) setTimeout(() => mapa.invalidateSize(), 100);
};

window.executarAcaoOperador = async function (acao) {
    const fb = document.getElementById('operador-feedback');
    fb.style.display = 'block';

    let endpoint = '';
    if (acao.includes('Calibrar')) endpoint = '/api/calibrar-ambiente?segundos=45';
    else if (acao.includes('Estável')) endpoint = '/api/treinar-amostra?classe=0&segundos=10';
    else if (acao.includes('Pré-Deslizamento')) endpoint = '/api/treinar-amostra?classe=2&segundos=10';
    else if (acao.includes('Resetar')) endpoint = '/api/modelo/resetar-treino';

    if (!wsConectado) {
        fb.textContent = `⚠️ Servidor Python offline: "${acao}" simulado localmente.`;
        return;
    }

    fb.textContent = `⏳ Enviando comando "${acao}" para o servidor Python...`;
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST' });
        if (res.ok) {
            fb.textContent = `✅ Comando "${acao}" iniciado no servidor! Aguarde a coleta na maquete.`;
        } else {
            const err = await res.json().catch(() => ({}));
            fb.textContent = `❌ Erro: ${err.detail || 'Falha ao executar no servidor.'}`;
        }
    } catch {
        fb.textContent = '❌ Sem resposta do servidor Python.';
    }
};

window.exportarCSV = function () {
    const lista = wsConectado ? leiturasSQLite : historicoSimulado;
    if (!lista.length) return;
    const linhas = ['Timestamp,Estacao,Umidade_%,Inclinacao_deg,Vib_RMS_mg,Vib_Pico_mg,Chuva_mm,RSSI_dBm,Risco_IA_%'];
    lista.forEach(d => {
        linhas.push(`${d.timestamp || d.created_at},${d.estacao_id},${d.umidade ?? ''},${d.inclinacao ?? ''},${d.vib_rms ?? ''},${d.vib_pico ?? ''},${d.chuva_mm ?? ''},${d.rssi ?? ''},${d.risco_ia_pct ?? ''}`);
    });
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sentinela_telemetria_ia.csv';
    link.click();
};

// Ignição
iniciarMapa();
iniciarGrafico();
conectarWebSocket();
renderizarTudo();
setInterval(() => {
    if (!wsConectado) renderizarTudo();
}, 2500);