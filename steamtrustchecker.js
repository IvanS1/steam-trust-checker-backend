const express = require('express');
const cors = require('cors'); // 1. Importa cors
const axios = require('axios');
const path = require('path'); // Añade esto

const app = express();

app.use(cors()); // 2. Habilita cors antes de tus rutas
// IMPORTANTE: Render asigna un puerto automáticamente, usa process.env.PORT
const port = process.env.PORT || 3000; 

const STEAM_API_KEY = 'CE910D32F9508B963444CAFF3F831E0C';

// 1. Servir archivos estáticos (index.html, style.css, app.js)
app.use(express.static(path.join(__dirname, '/')));

// 2. Ruta para el Home (opcional si usas express.static, pero recomendado)
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

        // ─────────────────────────────
        // 1️⃣ EXTRAER O RESOLVER STEAMID
        // ─────────────────────────────

        // profiles/STEAMID64
        const profileMatch = steamURL.match(/profiles\/(\d{17})/);
        if (profileMatch) {
            steamId64 = profileMatch[1];
        }

        // id/vanityname
        const vanityMatch = steamURL.match(/id\/([^\/]+)/);
        if (!steamId64 && vanityMatch) {
            const vanityName = vanityMatch[1];

            const vanityRes = await axios.get(
                'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
                {
                    params: {
                        key: STEAM_API_KEY,
                        vanityurl: vanityName
                    }
                }
            );

            if (vanityRes.data.response.success !== 1) {
                return res.status(404).json({ error: 'Perfil de Steam no encontrado' });
            }

            steamId64 = vanityRes.data.response.steamid;
        }

        if (!steamId64) {
            return res.status(400).json({ error: 'URL de Steam inválida' });
        }

        // ─────────────────────────────
        // 2️⃣ DATOS DEL PERFIL
        // ─────────────────────────────

        const profileRes = await axios.get(
            'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
            {
                params: {
                    key: STEAM_API_KEY,
                    steamids: steamId64
                }
            }
        );

        const player = profileRes.data.response.players[0];
        if (!player) {
            return res.status(404).json({ error: 'Perfil de Steam no encontrado' });
        }

        // ─────────────────────────────
        // 3️⃣ JUEGOS Y TIEMPO JUGADO
        // ─────────────────────────────

        const gamesRes = await axios.get(
            'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
            {
                params: {
                    key: STEAM_API_KEY,
                    steamid: steamId64,
                    include_played_free_games: true
                }
            }
        );

        const games = gamesRes.data.response.games || [];
        const gamesPlayed = games.length;

        const totalPlaytime = games.reduce(
            (sum, game) => sum + (game.playtime_forever || 0),
            0
        );

        // minutos → horas
        const totalHours = Math.round(totalPlaytime / 60);

        // ─────────────────────────────
        // 4️⃣ TRUST FACTOR (EJEMPLO)
        // ─────────────────────────────

        let trustFactor = 40;
        if (totalHours > 2000) trustFactor = 100;
        else if (totalHours > 1000) trustFactor = 80;
        else if (totalHours > 300) trustFactor = 60;

        // ─────────────────────────────
        // RESPUESTA FINAL
        // ─────────────────────────────

        res.json({
            profileImage: player.avatarfull,
            stats: {
                gamesPlayed,
                totalPlaytimeHours: totalHours
            },
            trustFactor
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Error al obtener datos de Steam' });
    }
});

// IMPORTANTE: Cambia el app.listen para Render
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor activo en el puerto ${port}`);
});
