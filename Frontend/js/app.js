const API_URL = "http://localhost:3000/api/leituras";
let graficoSensores;
let mapa;
let marcadores = {}; // Guarda os pins do mapa

// Coordenadas fictícias para os primeiros testes (mais tarde a ESP32 pode enviar GPS)
const coordsBase = [-8.047562, -34.877002]; // Exemplo
function iniciarMapa() {
  mapa = L.map("mapa-sentinelas").setView(coordsBase, 15);

  // 1. Camada Base: O fundo escuro (Geografia)
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 16,
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    },
  ).addTo(mapa);

  // 2. Camada de Referência: Os nomes das cidades e ruas (Etiquetas)
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 16,
    },
  ).addTo(mapa);

  mapa.locate({ setView: true, maxZoom: 14 });

  mapa.on("locationfound", function (e) {
    coordsBase = [e.latlng.lat, e.latlng.lng];

    L.circleMarker(e.latlng, {
      radius: 7,
      fillColor: "#ffffff",
      color: "#4299e1", // Borda azul clara estilo neon
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    })
      .addTo(mapa)
      .bindPopup("<b>📍 Base de Comando</b>")
      .openPopup();
  });

  mapa.on("locationerror", function (e) {
    console.log("Acesso à localização recusado. A usar coordenadas padrão.");
  });
}
function iniciarGrafico() {
  const ctx = document.getElementById("graficoSensores").getContext("2d");

  let gradientUmid = ctx.createLinearGradient(0, 0, 0, 300);
  gradientUmid.addColorStop(0, "rgba(66, 153, 225, 0.4)");
  gradientUmid.addColorStop(1, "rgba(66, 153, 225, 0.0)");

  graficoSensores = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Umidade da Última Sentinela (%)",
          data: [],
          borderColor: "#4299e1",
          backgroundColor: gradientUmid,
          fill: true,
          borderWidth: 2,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: "#2d3342" },
          ticks: { color: "#8b949e" },
        },
        x: { grid: { color: "#2d3342" }, ticks: { color: "#8b949e" } },
      },
      plugins: { legend: { labels: { color: "#c9d1d9" } } },
    },
  });
}

async function atualizarCentroDeComando() {
  try {
    const resposta = await fetch(API_URL);
    const dados = await resposta.json();

    if (dados && dados.length > 0) {
      // Processar a rede: agrupar por sensor para saber quem está online
      const sensoresAtivos = {};
      let somaUmidade = 0;
      let maiorRisco = "SEGURO";

      dados.forEach((leitura) => {
        // Guarda apenas a última leitura de cada sensor
        if (!sensoresAtivos[leitura.sensor_id]) {
          sensoresAtivos[leitura.sensor_id] = leitura;
          somaUmidade += leitura.valor;
        }
      });

      const totalSensores = Object.keys(sensoresAtivos).length;
      const mediaUmidade = (somaUmidade / totalSensores).toFixed(1);

      // Atualizar Painel Global
      document.getElementById("sensores-ativos").textContent = totalSensores;
      document.getElementById("val-rede").textContent = "ONLINE";
      document.getElementById("val-umid-media").textContent =
        `${mediaUmidade} %`;

      // Limpar lista atual
      const listaSensores = document.getElementById("lista-sensores");
      listaSensores.innerHTML = "";

      // Renderizar sensores e mapa
      Object.values(sensoresAtivos).forEach((sensor, index) => {
        let statusClass = sensor.valor > 70 ? "perigo" : "seguro";
        if (sensor.valor > 70) maiorRisco = "PERIGO";
        else if (sensor.valor > 60 && maiorRisco !== "PERIGO")
          maiorRisco = "ATENÇÃO";

        // Adicionar na lista lateral
        const dataFormatada = new Date(sensor.created_at).toLocaleTimeString(
          "pt-PT",
        );
        listaSensores.innerHTML += `
                    <div class="sensor-item ${statusClass}">
                        <div class="sensor-info">
                            <h4>${sensor.sensor_id.toUpperCase()}</h4>
                            <p>Último ping: ${dataFormatada}</p>
                        </div>
                        <div class="sensor-value ${statusClass}">${sensor.valor}%</div>
                    </div>
                `;

        // Atualizar pin no mapa (gerar um desvio para não ficarem todos no mesmo ponto por agora)
        if (!marcadores[sensor.sensor_id]) {
          const lat = coordsBase[0] + index * 0.002;
          const lng = coordsBase[1] + index * 0.002;
          marcadores[sensor.sensor_id] = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: sensor.valor > 70 ? "#e53e3e" : "#4299e1",
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          })
            .addTo(mapa)
            .bindPopup(
              `<b>${sensor.sensor_id}</b><br>Umidade: ${sensor.valor}%`,
            );
        } else {
          // Atualiza a cor se o risco mudar
          marcadores[sensor.sensor_id].setStyle({
            fillColor: sensor.valor > 70 ? "#e53e3e" : "#4299e1",
          });
        }
      });

      // Atualizar Status Global
      const elStatusGlobal = document.getElementById("val-status-global");
      elStatusGlobal.textContent = maiorRisco;
      elStatusGlobal.className = `valor status ${maiorRisco.toLowerCase()}`;

      // Atualizar Gráfico (usando o histórico total para a curva temporal)
      const dadosGrafico = [...dados].reverse();
      graficoSensores.data.labels = dadosGrafico.map((d) => {
        const data = new Date(d.created_at);
        return `${data.getHours()}:${data.getMinutes().toString().padStart(2, "0")}`;
      });
      graficoSensores.data.datasets[0].data = dadosGrafico.map((d) => d.valor);
      graficoSensores.update();
    }
  } catch (erro) {
    console.error("Erro de telemetria:", erro);
    document.getElementById("val-rede").textContent = "FALHA DE LIGAÇÃO";
    document.getElementById("val-rede").style.color = "#e53e3e";
  }
}

// Ignição do Sistema
iniciarMapa();
iniciarGrafico();
atualizarCentroDeComando();
setInterval(atualizarCentroDeComando, 5000);
