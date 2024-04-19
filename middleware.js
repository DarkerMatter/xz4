const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');


let db = new sqlite3.Database(path.join(__dirname, 'db', 'users.db'), (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        discriminator TEXT,
        avatar TEXT,
        access_token TEXT,
        refreshToken TEXT,
        apikey TEXT,
        permissionsLevel INTEGER DEFAULT 1
    )`, (err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log("Users table created successfully.");
    });
});

function loadData() {
    const fileData = fs.readFileSync(path.join(__dirname, 'downloadData.json'), 'utf-8');
    return JSON.parse(fileData);
}

function checkAuthentication(req, res, next) {
    console.log('Check Authentication triggered'); // Log when the function is triggered
    if(req.isAuthenticated()){
        db.get('SELECT permissionsLevel FROM users WHERE id = ?', req.user.id, (err, row) => {
            if (err) {
                console.error('Database Selection Error', err.message);
                return res.send("Error occurred");
            }

            if (row && row.permissionsLevel > 0) {
                next();
            } else {
                res.redirect("/banned");
            }
        });
    } else{
        console.log('User is not authenticated'); // Log when the user is not authenticated
        res.redirect("/login");
    }
}
function checkPermissions(req, res, next) {
    var db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
            return next(err);  // Pass error to Express
        }
    });

    var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE id = ? OR apiKey = ?");
    stmt.get([req.user.id, req.user.apiKey], (err, row) => {
        stmt.finalize();

        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
        });

        if(err) {
            console.error(err);
            return next(err);  // Pass error to Express
        }

        if(!row || row.permissionsLevel < 2) {
            return res.status(403).json({error: 'Access denied. Insufficient permissions'});
        }

        next();  // If all checks pass, move to next middleware
    });
}

function checkApiKeyAndPermissions(req, res, next) {
    const providedApiKey = req.headers['x-api-key'];

    if (!providedApiKey) {
        return res.status(401).json({ error: 'API Key required.' });
    }

    const db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
            return next(err);
        }
    });

    var stmt = db.prepare("SELECT permissionsLevel FROM users WHERE apiKey = ?");
    stmt.get([providedApiKey], (err, row) => {
        stmt.finalize();

        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
        });

        if(err) {
            console.error(err);
            return next(err);  // Pass error to Express
        }

        if(!row || row.permissionsLevel < 3) {
            return res.status(403).json({error: 'Access denied. Insufficient permissions'});
        }

        next();
    });
}

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

module.exports = {
    loadData,
    checkAuthentication,
    checkAuth,
    db,
    checkPermissions,
    checkApiKeyAndPermissions,
};