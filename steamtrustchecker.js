const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '/')));

const STEAM_API_KEY = 'CE910D32F9508B963444CAFF3F831E0C';

app.get('/api/profile', async (req, res) => {
    const steamURL = req.query.url;
    if (!steamURL) return res.status(400).json({ error: 'URL requerida' });

    try {
        let steamId64 = null;

        // 1. Extraer ID
        const profileMatch = steamURL.match(/profiles\/(\d{17})/);
        const vanityMatch = steamURL.match(/id\/([^\/]+)/);

        if (profileMatch) {
            steamId64 = profileMatch[1];
        } else if (vanityMatch) {
            const vRes = await axios.get(`api.steampowered.com{STEAM_API_KEY}&vanityurl=${vanityMatch[1]}`);
            if (vRes.data.response.success === 1) steamId64 = vRes.data.response.steamid;
        }

        if (!steamId64) return res.status(400).json({ error: 'URL inválida' });

        // 2. Llamadas a la API
        const [pRes, bRes, gRes] = await Promise.all([
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamids=${steamId64}`),
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamids=${steamId64}`),
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamid=${steamId64}&include_played_free_games=true`)
        ]);

        // ERROR CORREGIDO AQUÍ: Acceder al índice [0]
        const player = pRes.data.response.players[0];
        const bans = bRes.data.players[0];
        const games = gRes.data.response.games || [];

        if (!player) return res.status(404).json({ error: 'Perfil no encontrado' });

        // 3. Cálculo de Trust Factor
        let trust = 30; // Base
        const cs2 = games.find(g => g.appid === 730);
        const cs2Hours = cs2 ? Math.round(cs2.playtime_forever / 60) : 0;

        if (cs2Hours > 1000) trust += 40;
        else if (cs2Hours > 200) trust += 20;

        if (player.timecreated) {
            const age = (Date.now() / 1000 - player.timecreated) / (3600 * 24 * 365);
            if (age > 8) trust += 30;
        }

        if (bans && (bans.VACBanned || bans.NumberOfGameBans > 0)) trust -= 60;

        res.json({
            profileImage: player.avatarfull,
            stats: { 
                gamesPlayed: games.length, 
                cs2Hours, 
                totalPlaytimeHours: Math.round(games.reduce((s, g) => s + g.playtime_forever, 0) / 60)
            },
            trustFactor: Math.min(100, Math.max(0, trust))
        });

    } catch (e) {
        res.status(500).json({ error: 'Error de conexión' });
    }
});

app.listen(port, '0.0.0.0', () => console.log(`Online en ${port}`));
