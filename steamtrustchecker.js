const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

const STEAM_API_KEY = 'CE910D32F9508B963444CAFF3F831E0C';  // Reemplaza con tu clave de API de Steam.

app.use(express.json());

// Ruta para obtener información del perfil de Steam
app.get('/api/profile', async (req, res) => {
    const steamURL = req.query.url;
    if (!steamURL) {
        return res.status(400).json({ error: 'URL de Steam es requerida' });
    }

    // Extraer SteamID de la URL (puede ser un ID personalizado o numérico)
    const steamIdMatch = steamURL.match(/steamcommunity.com\/(?:id\/([^\/]+)|profiles\/(\d+))/);
    let steamId = null;

    if (steamIdMatch) {
        steamId = steamIdMatch[1] || steamIdMatch[2];  // Si es "id/steamID" o "profiles/steamID"
    }

    if (!steamId) {
        return res.status(400).json({ error: 'URL de Steam no válida' });
    }

    try {
        // Solicitar los datos del perfil a la API de Steam
        const response = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/`, {
            params: {
                key: STEAM_API_KEY,
                steamids: steamId
            }
        });

        // Verificar si la respuesta contiene datos del jugador
        const playerData = response.data.response.players[0];
        
        if (!playerData) {
            return res.status(404).json({ error: 'Perfil de Steam no encontrado' });
        }

        // Calcular el trust factor (lógica simple)
        const trustFactor = calculateTrustFactor(playerData);

        // Devolver los datos en formato JSON
        res.json({
            profileImage: playerData.avatarfull,
            stats: {
                gamesPlayed: playerData.game_count,
                totalPlaytime: playerData.time_played,
            },
            trustFactor: trustFactor
        });
    } catch (error) {
        console.error('Error al obtener datos de la API de Steam:', error);
        res.status(500).json({ error: 'Error al obtener datos del perfil de Steam' });
    }
});

// Lógica para calcular el trust factor (ejemplo básico)
function calculateTrustFactor(playerData) {
    const gamesPlayed = playerData.game_count;
    if (gamesPlayed > 100) return 100;
    if (gamesPlayed > 50) return 80;
    return 40;
}

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
