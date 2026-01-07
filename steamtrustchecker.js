const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Servir archivos estáticos desde la raíz
app.use(express.static(path.join(__dirname, '/')));

const STEAM_API_KEY = 'CE910D32F9508B963444CAFF3F831E0C';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/profile', async (req, res) => {
    const steamURL = req.query.url;
    if (!steamURL) {
        return res.status(400).json({ error: 'URL de Steam requerida' });
    }

    try {
        let steamId64 = null;

        // 1️⃣ RESOLVER STEAMID64 (Corregido)
        const profileMatch = steamURL.match(/profiles\/(\d{17})/);
        const vanityMatch = steamURL.match(/id\/([^\/]+)/);

        if (profileMatch) {
            steamId64 = profileMatch[1];
        } else if (vanityMatch) {
            const vanityName = vanityMatch[1];
            const vanityRes = await axios.get('api.steampowered.com', {
                params: { key: STEAM_API_KEY, vanityurl: vanityName }
            });
            if (vanityRes.data.response.success === 1) {
                steamId64 = vanityRes.data.response.steamid;
            }
        }

        if (!steamId64) {
            return res.status(400).json({ error: 'URL de Steam inválida o perfil no encontrado' });
        }

        // 2️⃣ OBTENER DATOS EN PARALELO (Summaries + Bans + Games)
        const [profileRes, bansRes, gamesRes] = await Promise.all([
            axios.get('api.steampowered.com', { params: { key: STEAM_API_KEY, steamids: steamId64 } }),
            axios.get('api.steampowered.com', { params: { key: STEAM_API_KEY, steamids: steamId64 } }),
            axios.get('api.steampowered.com', { params: { key: STEAM_API_KEY, steamid: steamId64, include_played_free_games: true } })
        ]);

        const player = profileRes.data.response.players[0];
        if (!player) {
            return res.status(404).json({ error: 'Perfil de Steam no encontrado' });
        }

        const games = gamesRes.data.response.games || [];
        const bans = bansRes.data.players[0] || {};

        // 3️⃣ CÁLCULOS DE ESTADÍSTICAS
        const totalPlaytime = games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0);
        const totalHours = Math.round(totalPlaytime / 60);
        
        // Buscar horas específicas de CS2 (AppID 730)
        const cs2Game = games.find(g => g.appid === 730);
        const cs2Hours = cs2Game ? Math.round(cs2Game.playtime_forever / 60) : 0;

        // 4️⃣ ALGORITMO DE TRUST FACTOR ESTIMADO (0-100)
        let trustFactor = 20; // Base inicial baja

        // Puntos por horas totales y CS2
        if (cs2Hours > 1000) trustFactor += 30;
        else if (cs2Hours > 200) trustFactor += 15;
        
        if (totalHours > 3000) trustFactor += 20;
        
        // Puntos por antigüedad (si el perfil es público y muestra fecha de creación)
        if (player.timecreated) {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const accountAgeYears = (currentTimestamp - player.timecreated) / (3600 * 24 * 365);
            if (accountAgeYears > 10) trustFactor += 20;
            else if (accountAgeYears > 5) trustFactor += 10;
        }

        // Penalización por BANEOS (Crítico)
        if (bans.VACBanned || bans.NumberOfGameBans > 0 || bans.CommunityBanned) {
            trustFactor = Math.max(10, trustFactor - 60); // Baja drásticamente pero no a 0
        }

        // Limitar entre 0 y 100
        trustFactor = Math.min(100, Math.max(0, trustFactor));

        // 5️⃣ RESPUESTA FINAL
        res.json({
            profileImage: player.avatarfull,
            stats: {
                gamesPlayed: games.length,
                totalPlaytimeHours: totalHours,
                cs2Hours: cs2Hours,
                vacBanned: bans.VACBanned
            },
            trustFactor: trustFactor
        });

    } catch (err) {
        console.error("Error en servidor:", err.message);
        res.status(500).json({ error: 'Error al obtener datos de Steam' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor activo en el puerto ${port}`);
});
