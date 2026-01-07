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

  /* Trust bar */
  const bar = document.getElementById('trust-factor');
  bar.style.width = `${data.trustFactor}%`;
  bar.style.backgroundColor =
    data.trustFactor > 70 ? 'green' :
    data.trustFactor > 40 ? 'yellow' : 'red';

  document.getElementById('smurf-message').style.display =
    data.smurf ? 'block' : 'none';

  /* Chart (2weeks + forever FIX) */
  const topGames = (data.extra.games || [])
  .map(g => ({
    name: g.name,
    minutes:
      (g.playtime_forever || 0) + (g.playtime_2weeks || 0)
  }))
  .filter(g => g.minutes > 0)
  .sort((a, b) => b.minutes - a.minutes)
  .slice(0, 5);


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
      plugins: { legend: { display: false } }
    }
  });

  saveToRanking(data);
  renderRanking();
}
