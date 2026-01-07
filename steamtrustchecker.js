const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const { getCache, setCache } = require('./cache');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

const STEAM_API_KEY =
  process.env.STEAM_API_KEY || 'TU_API_KEY_AQUI';

/* ───────── HOME ───────── */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ───────── API PROFILE ───────── */
app.get('/api/profile', async (req, res) => {
  const steamURL = req.query.url;
  if (!steamURL) return res.status(400).json({ error: 'URL requerida' });

  try {
    /* 1️⃣ Resolver SteamID */
    let steamid = null;

    const profileMatch = steamURL.match(/profiles\/(\d{17})/);
    const vanityMatch = steamURL.match(/id\/([^\/]+)/);

    if (profileMatch) steamid = profileMatch[1];

    if (!steamid && vanityMatch) {
      const vanityRes = await axios.get(
        'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
        { params: { key: STEAM_API_KEY, vanityurl: vanityMatch[1] } }
      );
      steamid = vanityRes.data.response.steamid;
    }

    if (!steamid) {
      return res.status(400).json({ error: 'URL de Steam inválida' });
    }

    /* 2️⃣ CACHE */
    const cached = getCache(steamid);
    if (cached) return res.json(cached);

    /* 3️⃣ PERFIL */
    const profileRes = await axios.get(
      'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
      { params: { key: STEAM_API_KEY, steamids: steamid } }
    );

    const p = profileRes.data.response.players[0];

    /* 4️⃣ JUEGOS */
    const gamesRes = await axios.get(
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
      {
        params: {
          key: STEAM_API_KEY,
          steamid,
          include_appinfo: true,
          include_played_free_games: true
        }
      }
    );

    const games = gamesRes.data.response.games || [];
    const totalMinutes = games.reduce(
      (sum, g) => sum + (g.playtime_forever || 0),
      0
    );
    const totalHours = Math.round(totalMinutes / 60);

    /* 5️⃣ NIVEL */
    let level = 0;
    try {
      const levelRes = await axios.get(
        'https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/',
        { params: { key: STEAM_API_KEY, steamid } }
      );
      level = levelRes.data.response.player_level;
    } catch {}

    /* 6️⃣ AMIGOS */
    let friendsCount = 0;
    try {
      const friendsRes = await axios.get(
        'https://api.steampowered.com/ISteamUser/GetFriendList/v1/',
        { params: { key: STEAM_API_KEY, steamid } }
      );
      friendsCount = friendsRes.data.friendslist.friends.length;
    } catch {}

    /* 7️⃣ DETECCIÓN DE SMURF (REALISTA) */
    const accountAgeYears =
      (Date.now() - p.timecreated * 1000) /
      (1000 * 60 * 60 * 24 * 365);

    const smurf =
      accountAgeYears < 1 &&
      level < 10 &&
      totalHours > 300 &&
      friendsCount < 20;

    /* 8️⃣ TRUST FACTOR */
    let trustFactor = 30;
    if (totalHours > 300) trustFactor += 20;
    if (totalHours > 1000) trustFactor += 20;
    if (level > 20) trustFactor += 15;
    if (friendsCount > 50) trustFactor += 15;
    if (!smurf) trustFactor += 10;

    trustFactor = Math.min(trustFactor, 100);

    /* 9️⃣ RESPUESTA FINAL */
    const response = {
      profileImage: p.avatarfull,
      stats: {
        gamesPlayed: games.length,
        totalPlaytimeHours: totalHours
      },
      trustFactor,
      smurf,
      extra: {
        personaname: p.personaname,
        country: p.loccountrycode || 'N/A',
        level,
        friendsCount,
        games
      }
    };

    setCache(steamid, response);
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos de Steam' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor activo en puerto ${port}`);
});
