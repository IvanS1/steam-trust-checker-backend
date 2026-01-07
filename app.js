let chart;

async function getProfile() {
  const url = document.getElementById('steam-url').value.trim();
  if (!url) return alert('Introduce una URL de Steam');

  const res = await fetch(`/api/profile?url=${encodeURIComponent(url)}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    alert(data.error || 'Error al obtener el perfil');
    return;
  }

  document.getElementById('profile-image').src = data.profileImage;

  document.getElementById('stats').innerHTML = `
    <p><strong>${data.extra.personaname}</strong> (${data.extra.country})</p>
    <p>Juegos: ${data.stats.gamesPlayed}</p>
    <p>Horas totales: ${data.stats.totalPlaytimeHours}</p>
    <p>Nivel Steam: ${data.extra.level}</p>
    <p>Amigos visibles: ${data.extra.friendsCount}</p>
  `;

  /* Trust bar */
  const bar = document.getElementById('trust-factor');
  bar.style.width = `${data.trustFactor}%`;
  bar.style.backgroundColor =
    data.trustFactor > 70 ? 'green' :
    data.trustFactor > 40 ? 'yellow' : 'red';

  /* Smurf */
  document.getElementById('smurf-message').style.display =
    data.smurf ? 'block' : 'none';

  /* Chart */
  const topGames = (data.extra.games || [])
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 5);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('hoursChart'), {
    type: 'bar',
    data: {
      labels: topGames.map(g => g.name),
      datasets: [{
        label: 'Horas jugadas',
        data: topGames.map(g => Math.round(g.playtime_forever / 60)),
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}
