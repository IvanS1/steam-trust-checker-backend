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

  // === TRUST FACTOR BAR ===
  const trustFactor = data.trustFactor;

  const trustBar = document.getElementById('trust-factor');
  const trustText = document.getElementById('trust-factor-text');

  trustBar.style.width = trustFactor + '%';
  trustText.textContent = trustFactor + '%';

  if (trustFactor < 40) {
    trustBar.style.background = '#e53935';
  } else if (trustFactor < 70) {
    trustBar.style.background = '#fbc02d';
  } else {
    trustBar.style.background = '#43a047';
  }

  /* Aviso CS2 */
  document.getElementById('cs-warning').style.display =
    data.extra.csDataVisible ? 'none' : 'block';

  /* Trust bar */
  const bar = document.getElementById('trust-factor');
  bar.style.width = `${data.trustFactor}%`;
  bar.style.backgroundColor =
    data.trustFactor > 70 ? 'green' :
    data.trustFactor > 40 ? 'yellow' : 'red';

  /* Chart — TOP 10 JUEGOS RECIENTES + HISTÓRICOS */
  const topGames = (data.extra.games || [])
    .map(g => ({
      name: g.name,
      minutes:
        (g.playtime_forever || 0) + (g.playtime_2weeks || 0)
    }))
    .filter(g => g.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('hoursChart'), {
    type: 'bar',
    data: {
      labels: topGames.map(g => g.name),
      datasets: [{
        label: 'Horas jugadas',
        data: topGames.map(g => Math.round(g.minutes / 60)),
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  saveToRanking(data);
  renderRanking();
}
