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

        // 1. Resolver SteamID64
        const profileMatch = steamURL.match(/profiles\/(\d{17})/);
        const vanityMatch = steamURL.match(/id\/([^\/]+)/);

        if (profileMatch) {
            steamId64 = profileMatch[1];
        } else if (vanityMatch) {
            const vanityRes = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
                params: { key: STEAM_API_KEY, vanityurl: vanityMatch[1] }
            });
            if (vanityRes.data.response.success === 1) steamId64 = vanityRes.data.response.steamid;
        }

        if (!steamId64) return res.status(404).json({ error: 'Usuario no encontrado' });

        // 2. PETICIONES EN PARALELO (Más rápido)
        const [profileRes, bansRes, gamesRes] = await Promise.all([
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamids=${steamId64}`),
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamids=${steamId64}`),
            axios.get(`api.steampowered.com{STEAM_API_KEY}&steamid=${steamId64}&include_played_free_games=true`)
        ]);

        const player = profileRes.data.response.players[0];
        const bans = bansRes.data.players[0];
        const games = gamesRes.data.response.games || [];

        if (!player) return res.status(404).json({ error: 'Perfil privado o inexistente' });

        // 3. CÁLCULO DE TRUST FACTOR REALISTA (0 a 100)
        let score = 0;
        
        // A. Horas en CS2 (AppID 730)
        const cs2Game = games.find(g => g.appid === 730);
        const cs2Hours = cs2Game ? Math.round(cs2Game.playtime_forever / 60) : 0;
        
        if (cs2Hours > 2000) score += 40;
        else if (cs2Hours > 500) score += 25;
        else if (cs2Hours > 100) score += 10;

        // B. Estado de Baneos (Penalización máxima)
        let hasBans = bans.VACBanned || bans.NumberOfGameBans > 0;
        if (hasBans) score -= 50; 
        else score += 20;

        // C. Nivel de Steam
        const steamLevel = player.playerlevel || 10; // Si es privado asumimos bajo
        if (steamLevel > 50) score += 20;
        else if (steamLevel > 15) score += 10;

        // D. Antigüedad (Time Created)
        if (player.timecreated) {
            const years = (new Date().getTime() / 1000 - player.timecreated) / (3600 * 24 * 365);
            if (years > 10) score += 20;
            else if (years > 3) score += 10;
        }

        // Ajustar límites
        const finalTrust = Math.max(0, Math.min(100, score));

        res.json({
            profileImage: player.avatarfull,
            personaName: player.personaname,
            stats: {
                cs2Hours,
                steamLevel: player.playerlevel || 'Privado',
                isBanned: hasBans
            },
            trustFactor: finalTrust
        });

    } catch (err) {
        res.status(500).json({ error: 'Error conectando con Steam' });
    }
});

app.listen(port, '0.0.0.0', () => console.log(`Puerto: ${port}`));
