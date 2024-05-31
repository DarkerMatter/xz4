var express = require('express');
var passport = require('passport');
const fs = require('fs');
const util = require('util');
const sqlite3 = require('sqlite3').verbose();
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

var router = express.Router();

const { checkAuthentication, db, checkPermissions, checkApiKeyAndPermissions} = require('../middleware');
const {Strategy: DiscordStrategy} = require("passport-discord");
const axios = require("axios");
const {isAuthenticated} = require("passport/lib/http/request");
let usersProcessingMap = new Map();


passport.use(new DiscordStrategy({
  clientID: process.env.clientID,
  clientSecret: process.env.clientSecret,
  callbackURL: process.env.callbackURL,
  scope: ['identify', 'guilds'],
}, function (accessToken, refreshToken, profile, done) {
  usersProcessingMap.set(profile.id, false); // Reset or set this user's created status to false
  db.get('SELECT apikey FROM users WHERE id = ?', profile.id, (err, row) => {
    if (err) {
      console.error(err.message);
      done(err);
      return;
    }
    if (row) {
      // User exists and apiKey already exists, skip api key generation
      profile.apiKey = row.apikey;
      done(null, profile);
    } else {
      // User doesn't exists or apiKey doesn't exists, generate new api key
      axios({
        method: 'post',
        url: 'https://lci.fts.gg/create',
        headers: { 'API_KEY': process.env.API_KEY },
        data: {
          id: profile.id,
          product: 'jel-lci',
        },
      })
          .then(response => {
            const licenseKey = response.data.licenseKey;
            db.run(`INSERT INTO users(id, username, discriminator, avatar, access_token, refreshToken, apikey)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [profile.id, profile.username, profile.discriminator, profile.avatar, accessToken, refreshToken, licenseKey],
                e => {
                  if (e) console.error(e);
                  usersProcessingMap.set(profile.id, true); // Set this user's created status to true
                  profile.apiKey = licenseKey;
                  done(null, profile);
                });
          })
          .catch(error => {
            console.error(error);
            done(error);
          });
    }
  });
}));



router.get('/login', passport.authenticate('discord'));

router.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect to dashboard.
      res.redirect('/dashboard');
    }
);

router.get('/dashboard', checkAuthentication, function(req, res) {
  const username = req.user.username;

  db.get(`SELECT * from users where username=?`, [username], function(err, user) {
    if (err) {
      return res.status(500).send(err);
    }
    if (!user) {
      return res.status(404).send('User not found');
    }
    const permissionsLevel = Number(user.permissionsLevel);
    const avatar = user.avatar;
    const discordid = user.id;

    res.render('dashboard', { user: req.user, username: username, permissionsLevel: permissionsLevel, avatar: avatar, discordid: discordid});
  });
});

router.get('/api/hd2/ct/latest', function(req, res) {
    const userApiKey = req.query.apikey || null;

    var db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error while connecting to the database' });
        }
    });
    fs.appendFile('logs/downloads.txt', `User: ${userApiKey} downloaded CT\n`, function (err) {
        if (err) console.error('Error on logging: ', err);
    });

    if(!userApiKey) {
        const getkeyURL = `${req.protocol}://${req.get('host')}/api/getkey`;

        axios.get(getkeyURL, {
            headers: { 'Cookie': req.headers.cookie }
        })
            .then(response => {
                const apiKey = response.data.apiKey;
                var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE apiKey = ?");
                stmt.get(apiKey, (err, row) => {
                    stmt.finalize();

                    db.close((err) => {
                        if (err) {
                            console.error(err.message);
                        }
                    });

                    if(err) {
                        console.error(err);
                        return res.status(500).json({error: 'Error while fetching user permissions from the database'});
                    }

                    if(row.permissionsLevel === 0) {
                        return res.status(403).json({error: 'Access denied, user has been banned'});
                    } else {
                        downloadCTWithKey(apiKey, res);
                    }
                });
            })
            .catch(error => {
                return res.status(500).json({error: 'Error while fetching API key'});
            });
    } else {
        var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE apiKey = ?");
        stmt.get(userApiKey, (err, row) => {
            stmt.finalize();

            db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
            });

            if(err) {
                console.error(err);
                return res.status(500).json({error: 'Error while fetching user permissions from the database'});
            }

            if(row.permissionsLevel === 0) {
                return res.status(403).json({error: 'Access denied, user has been banned'});
            } else {
                downloadCTWithKey(userApiKey, res);
            }
        });
    }
});

function downloadCTWithKey(apiKey, res) {
    axios({
        method: 'get',
        url: `https://drm.fts.gg/v2/download?latest&subfolder=ct&apikey=${apiKey}`,
        responseType: 'stream'
    })
        .then(response => {
            // Set the headers to provide a file for download
            res.setHeader('Content-Disposition', 'attachment; filename=latest.ct');
            response.data.pipe(res);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: 'Error while fetching data from DRM API'});
        });
}

router.get('/api/hd2/bundle/latest', function(req, res) {
    const userApiKey = req.query.apikey || null;

    var db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error while connecting to the database' });
        }
    });
    fs.appendFile('logs/downloads.txt', `User: ${userApiKey} downloaded Bundle\n`, function (err) {
        if (err) console.error('Error on logging: ', err);
    });

    if(!userApiKey) {
        const getkeyURL = `${req.protocol}://${req.get('host')}/api/getkey`;

        axios.get(getkeyURL, {
            headers: { 'Cookie': req.headers.cookie }
        })
            .then(response => {
                const apiKey = response.data.apiKey;
                var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE apiKey = ?");
                stmt.get(apiKey, (err, row) => {
                    stmt.finalize();

                    db.close((err) => {
                        if (err) {
                            console.error(err.message);
                        }
                    });

                    if(err) {
                        console.error(err);
                        return res.status(500).json({error: 'Error while fetching user permissions from the database'});
                    }

                    if(row.permissionsLevel === 0) {
                        return res.status(403).json({error: 'Access denied, user has been banned'});
                    } else {
                        downloadBundleWithKey(apiKey, res);
                    }
                });
            })
            .catch(error => {
                return res.status(500).json({error: 'Error while fetching API key'});
            });
    } else {
        var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE apiKey = ?");
        stmt.get(userApiKey, (err, row) => {
            stmt.finalize();

            db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
            });

            if(err) {
                console.error(err);
                return res.status(500).json({error: 'Error while fetching user permissions from the database'});
            }

            if(row.permissionsLevel === 0) {
                return res.status(403).json({error: 'Access denied, user has been banned'});
            } else {
                downloadBundleWithKey(userApiKey, res);
            }
        });
    }
});


function downloadBundleWithKey(apiKey, res) {
    axios({
        method: 'get',
        url: `https://drm.fts.gg/v2/download?latest&subfolder=bundle&apikey=${apiKey}`,
        responseType: 'stream'
    })
        .then(response => {
            // Set the headers to provide a file for download
            res.setHeader('Content-Disposition', 'attachment; filename=latest.zip');
            response.data.pipe(res);

        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: 'Error while fetching data from DRM API'});
        });
}

router.get('/api/getkey', function(req, res) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'User is not authenticated' });
  }

  const userId = req.user.id;

  // Fetch user's apiKey from DB
  db.get('SELECT apikey FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Check if apikey field exists and not null
    if (!row || !row.apikey) {
      return res.status(403).json({ error: 'API Key not found' });
    }

    // Use the apikey from the database
    const userApiKey = row.apikey;

    // Send apiKey as response
    res.json({ apiKey: userApiKey });
  });
});

router.get('/api/ce', function(req, res) {
    axios({
        method: 'get',
        url: 'https://drm.fts.gg/v2/download?latest&subfolder=ce',
        responseType: 'stream'
    })
        .then(response => {
            // Set the headers to provide a file for download
            res.setHeader('Content-Disposition', 'attachment; filename=CheatEngine.exe');
            response.data.pipe(res);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: 'Error while fetching data from DRM API'});
        });
});

router.post('/api/admin/ban', checkApiKeyAndPermissions, async(req, res) => {
    const targetUserId = req.body.userId;

    if (!targetUserId) {
        return res.status(400).send({ error: 'You must provide the id of the user to ban.' });
    }

    const db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error while connecting to the database' });
        }
    });

    db.run(`UPDATE users SET permissionsLevel = 0 WHERE id = ?`, targetUserId, function(err) {
        if (err) {
            return console.error(err.message);
        }
        res.json({ success: `User ${targetUserId} has been banned.` });
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
    });
});

router.get('/admin', checkAuthentication, checkPermissions, function(req, res) {
    const username = req.user.username;

    db.get(`SELECT * from users where username=?`, [username], function(err, user) {
        if (err) {
            return res.status(500).send(err);
        }
        if (!user) {
            return res.status(404).send('User not found');
        }
        const permissionsLevel = Number(user.permissionsLevel);
        res.render('admin', { user: req.user, username: username, permissionsLevel: permissionsLevel });
    });
});

router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

router.get('/banned', function(req, res) {
  res.render('banned');
});


module.exports = router;