Chart.register(ChartDataLabels);

let chart;

/* ───── Ranking local ───── */
function saveToRanking(data) {
  const ranking = JSON.parse(localStorage.getItem('trustRanking')) || [];

  const existing = ranking.find(p => p.steamid === data.steamid);
  if (existing) {
    existing.trustFactor = data.trustFactor;
  } else {
    ranking.push({
      steamid: data.steamid,
      name: data.extra.personaname,
      trustFactor: data.trustFactor
    });
  }

  ranking.sort((a, b) => b.trustFactor - a.trustFactor);
  localStorage.setItem('trustRanking', JSON.stringify(ranking.slice(0, 10)));
}

function renderRanking() {
  const ranking = JSON.parse(localStorage.getItem('trustRanking')) || [];
  const container = document.getElementById('ranking');

  if (!ranking.length) {
    container.innerHTML = '<p>No hay perfiles aún</p>';
    return;
  }

  container.innerHTML = `
    <h3>🏆 Ranking local Trust Factor</h3>
    <ol>
      ${ranking.map(p =>
        `<li>${p.name} — <strong>${p.trustFactor}</strong></li>`
      ).join('')}
    </ol>
  `;
}

/* ───── Main ───── */
async function getProfile() {
  const url = document.getElementById('steam-url').value.trim();
  if (!url) return alert('Introduce una URL de Steam');

  const res = await fetch(`/api/profile?url=${encodeURIComponent(url)}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    alert(data.error || 'Error al obtener perfil');
    return;
  }

  document.getElementById('profile-image').src = data.profileImage;

  document.getElementById('stats').innerHTML = `
    <p><strong>${data.extra.personaname}</strong> (${data.extra.country})</p>
    <p>Juegos: ${data.stats.gamesPlayed}</p>
    <p>Horas totales: ${data.stats.totalPlaytimeHours}</p>
    <p>Horas CS2: ${data.stats.csHours}</p>
    <p>Nivel Steam: ${data.extra.level}</p>
    <p>Amigos visibles: ${data.extra.friendsCount}</p>
  `;

  const trustBar = document.getElementById('trust-factor');
  const trustText = document.getElementById('trust-factor-text');

  trustBar.style.width = `${data.trustFactor}%`;
  trustText.textContent = `${data.trustFactor}%`;

  trustBar.style.backgroundColor =
    data.trustFactor > 70 ? 'green' :
    data.trustFactor > 40 ? 'yellow' : 'red';

  document.getElementById('cs-warning').style.display =
    data.extra.csDataVisible ? 'none' : 'block';

  /* ───── Chart ───── */
  const topGames = (data.extra.games || [])
    .map(g => ({
      appid: g.appid,
      name: g.name,
      icon: g.img_icon_url,
      hours: Math.round(
        ((g.playtime_forever || 0) + (g.playtime_2weeks || 0)) / 60
      )
    }))
    .filter(g => g.hours > 0 && g.icon)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  if (chart) chart.destroy();

  const icons = {};
  topGames.forEach(g => {
    const img = new Image();
    img.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.icon}.jpg`;
    icons[g.appid] = img;
  });

  const yAxisIconPlugin = {
    id: 'yAxisIconPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales: { y } } = chart;
      ctx.save();
  
      // 📐 ancho reservado para labels (debe coincidir con layout.padding.left)
      const LABEL_WIDTH = 220;
  
      // 📐 tamaño del icono
      const ICON_SIZE = 18;
  
      // 📐 posición X centrada entre texto y barra
      const iconX = chartArea.left - (LABEL_WIDTH / 2) - (ICON_SIZE / 2) + 10;
  
      topGames.forEach(game => {
        const yPos = y.getPixelForValue(game.name);
        const icon = icons[game.appid];
  
        if (!icon || !icon.complete || icon.naturalWidth === 0) return;
  
        ctx.drawImage(
          icon,
          iconX,
          yPos - ICON_SIZE / 2,
          ICON_SIZE,
          ICON_SIZE
        );
      });
  
      ctx.restore();
    }
  };
  

  chart = new Chart(document.getElementById('hoursChart'), {
    type: 'bar',
    data: {
      labels: topGames.map(g => g.name),
      datasets: [{
        data: topGames.map(g => g.hours),
        backgroundColor: '#4CAF50'
      }]
    },
    plugins: [ChartDataLabels, yAxisIconPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
  
      indexAxis: 'y',
  
      layout: {
        padding: {
          left: 220,
          right: 20
        }
      },
  
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'right',
          color: '#ffffff',
          font: {
            weight: 'bold',
            size: 11
          },
          formatter: value => `${value}h`
        }
      },
  
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: v => `${v}h`
          }
        },
        y: {
          ticks: {
            color: '#cccccc',
            padding: 6
          }
        }
      }
    }
  });
  window.addEventListener('resize', () => {
    if (chart) {
      chart.resize();
    }
  });
    

  saveToRanking(data);
  renderRanking();
}
