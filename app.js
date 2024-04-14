const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const rateLimit = require("express-rate-limit");
var favicon = require('serve-favicon');
const axios = require('axios');
require('dotenv').config();
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'logo.png')));


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Function to increment and save download data for any downloaded file
const incrementDownload = () => {
  const data = loadData();
  data.totalDownloads++;
  fs.writeFileSync(path.join(__dirname, 'downloadData.json'), JSON.stringify(data), { encoding: 'utf-8' });
}

const loadData = () => {
  const fileData = fs.readFileSync(path.join(__dirname, 'downloadData.json'), 'utf-8');
  return JSON.parse(fileData);
};


// replace your 'app.get('/')' with this:
app.get('/', function(req, res) {
  const downloadData = loadData();
  res.render('index', {
    totalDownloads: downloadData.totalDownloads,
  });
});



app.get('/ct/latest', async function(req, res) {
  try {
    const url = `https://drm.fts.gg/v2/download?latest&subfolder=ct&apikey=${process.env.API_KEY}`;

    axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    })
        .then(function(response) {
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Disposition", 'attachment; filename="latest.ct"');
          response.data.pipe(res);
        });

  } catch (error) {
    console.error("Could not download the file.", error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/bundle/latest', async function(req, res) {
  try {
    const url = `https://drm.fts.gg/v2/download?latest&subfolder=bundle&apikey=${process.env.API_KEY}`;

    axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    })
        .then(function(response) {
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Disposition", 'attachment; filename="latest.rar"');
          response.data.pipe(res);
        });

  } catch (error) {
    console.error("Could not download the file.", error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/ce', function(req, res){
  const file = `${__dirname}/cheatengine/CheatEngine75.exe`;
  incrementDownload();
  res.download(file); // Set disposition and send it.
});

app.use(function(req, res, next) {
  res.status(404);
  res.render('404');
});

app.listen(1738, function(){
  console.log('App listening on port 1738!');
});
module.exports = app;