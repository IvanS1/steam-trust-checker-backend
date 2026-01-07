const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const { getCache, setCache } = require('./cache');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const STEAM_API_KEY = process.env.STEAM_API_KEY || 'CE910D32F9508B963444CAFF3F831E0C';

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

    /* 2️⃣ Cache */
    const cached = getCache(steamid);
    if (cached) return res.json(cached);

    /* 3️⃣ Perfil */
    const profileRes = await axios.get(
      'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
      { params: { key: STEAM_API_KEY, steamids: steamid } }
    );

    const p = profileRes.data.response.players[0];

    /* 4️⃣ Juegos */
    const gamesRes = await axios.get(
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
      {
        params: {
          key: STEAM_API_KEY,
          steamid,
          include_appinfo: true,
          include_played_free_games: true,
          include_playtime_2weeks: true
        }
      }
    );
    

    const games = gamesRes.data.response.games || [];

    const totalMinutes = games.reduce(
      (sum, g) => sum + (g.playtime_forever || 0),
      0
    );
    const totalHours = Math.round(totalMinutes / 60);

    /* 5️⃣ Nivel */
    let level = 0;
    try {
      const levelRes = await axios.get(
        'https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/',
        { params: { key: STEAM_API_KEY, steamid } }
      );
      level = levelRes.data.response.player_level;
    } catch {}

    /* 6️⃣ Amigos (perfil privado safe) */
    let friendsCount = 0;
    try {
      const friendsRes = await axios.get(
        'https://api.steampowered.com/ISteamUser/GetFriendList/v1/',
        { params: { key: STEAM_API_KEY, steamid } }
      );

      if (
        friendsRes.data?.friendslist?.friends &&
        Array.isArray(friendsRes.data.friendslist.friends)
      ) {
        friendsCount = friendsRes.data.friendslist.friends.length;
      }
    } catch {}

    /* 7️⃣ Edad cuenta */
    const accountAgeYears = p.timecreated
      ? (Date.now() - p.timecreated * 1000) / (1000 * 60 * 60 * 24 * 365)
      : 10;

    /* 8️⃣ HORAS CS2 (Trust Factor CS-only) */
    const csGame = games.find(g => g.appid === 730);
    const csHours = csGame
  ? Math.round(
      ((csGame.playtime_forever || 0) + (csGame.playtime_2weeks || 0)) / 60
    )
  : 0;


    /* 9️⃣ Trust Factor (CS-only) */
    let trustFactor = 30;

    if (csHours > 100) trustFactor += 20;
    if (csHours > 500) trustFactor += 25;
    if (level > 20) trustFactor += 10;
    if (friendsCount > 50) trustFactor += 10;

    trustFactor = Math.min(trustFactor, 100);

    /* 🔟 Respuesta final */
    const response = {
      steamid,
      profileImage: p.avatarfull,
      stats: {
        gamesPlayed: games.length,
        totalPlaytimeHours: totalHours,
        csHours
      },
      trustFactor,
      extra: {
        personaname: p.personaname,
        country: p.loccountrycode || 'N/A',
        level,
        friendsCount,
        accountAgeYears: Math.floor(accountAgeYears),
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
