async function getProfile() {
    const urlInput = document.getElementById('steam-url').value;
    if (!urlInput) {
        alert('Por favor, ingresa una URL de perfil de Steam.');
        return;
    }

    try {
        // CORRECCIÓN AQUÍ: No uses la URL de GitHub. 
        // Usa `/api/profile` para que llame a tu propio backend en Render.
        const response = await fetch(`/api/profile?url=${encodeURIComponent(urlInput)}`);
        
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }

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
        alert('Error al recuperar los datos del perfil. Revisa la consola.');
    }
}
