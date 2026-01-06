async function getProfile() {
    const url = document.getElementById('steam-url').value;
    if (!url) {
        alert('Por favor, ingresa una URL de perfil de Steam.');
        return;
    }

    try {
        const response = await fetch(`https://github.com/IvanS1/steam-trust-checker-backend.git`);
        const data = await response.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        // Mostrar imagen del perfil
        document.getElementById('profile-image').src = data.profileImage;

        // Mostrar stats
        document.getElementById('stats').innerHTML = `
            <p>Juegos jugados: ${data.stats.gamesPlayed}</p>
            <p>Horas totales: ${data.stats.totalPlaytimeHours}</p>
        `;

        // Actualizar barra de Trust Factor
        const trustBar = document.getElementById('trust-factor');
        trustBar.style.width = `${data.trustFactor}%`;
        if (data.trustFactor >= 80) trustBar.style.backgroundColor = 'green';
        else if (data.trustFactor >= 40) trustBar.style.backgroundColor = 'yellow';
        else trustBar.style.backgroundColor = 'red';

    } catch (err) {
        console.error(err);
        alert('Error al obtener los datos del perfil.');
    }
}
