const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const axios = require('axios');
const favicon = require('serve-favicon');
const rateLimit = require("express-rate-limit");
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

require('dotenv').config();

const app = express();
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'logo.png')));
app.use(express.json());


app.use(session({
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000  // cookie lasts for a day
    }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 100 requests per WindowMs
    message:
        "Too many requests from this IP, please try again after 15 minutes."
});

app.use(limiter);


app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

var indexRouter = require('./routes/index');
const {isAuthenticated} = require("passport/lib/http/request");
app.use('/', indexRouter);

app.use(function(req, res, next) {
    res.status(404);
    res.render('404');
});

module.exports = app;