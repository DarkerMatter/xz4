const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const rateLimit = require("express-rate-limit");
var favicon = require('serve-favicon');
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
  // Load the current data
  const data = loadData();

  // Increment the total downloads count
  data.totalDownloads++;

  // Write the updated data back to the file
  fs.writeFileSync(path.join(__dirname, 'downloadData.json'), JSON.stringify(data), { encoding: 'utf-8' });
}

const loadData = () => {
  const fileData = fs.readFileSync(path.join(__dirname, 'downloadData.json'), 'utf-8');
  return JSON.parse(fileData);
};


// replace your 'app.get('/')' with this:
app.get('/', function(req, res) {
  const downloadData = loadData();
  fs.readdir('./ct', function(err, filesCt) {
    fs.readdir('./bundle', function(err, filesBundle) {
      if (err) {
        console.error("Could not list the directory.", err);
        process.exit(1);
      }

      // Extract version number and the full file name for 'ct' and 'bundle' from each file, and store in an array of arrays
      let versionedFilesCt = getVersionedFiles(filesCt);
      let versionedFilesBundle = getVersionedFiles(filesBundle);

      // Conditionally set latest version and previous version for 'ct' and 'bundle'
      let sortedByVersionCt = versionedFilesCt.sort((a, b) => semver.rcompare(a[0], b[0]));
      let latestVersionCt = sortedByVersionCt.length > 0 ? sortedByVersionCt[0][1] : "N/A";
      let previousVersionCt = sortedByVersionCt.length > 1 ? sortedByVersionCt[1][1] : "N/A";

      let sortedByVersionBundle = versionedFilesBundle.sort((a, b) => semver.rcompare(a[0], b[0]));
      let latestVersionBundle = sortedByVersionBundle.length > 0 ? sortedByVersionBundle[0][1] : "N/A";
      let previousVersionBundle = sortedByVersionBundle.length > 1 ? sortedByVersionBundle[1][1] : "N/A";

      res.render('index', {
        totalDownloads: downloadData.totalDownloads,
        latestVersionCt: latestVersionCt,
        previousVersionCt: previousVersionCt,
        latestVersionBundle: latestVersionBundle,
        previousVersionBundle: previousVersionBundle
      });
    });
  });
});

function getVersionedFiles(files) {
  return files.map(file => {
    let versionMatch = file.match(/(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return [versionMatch[0], file];
    } else {
      return null;
    }
  }).filter(file => file !== null); // Filter out any files that do not include a version number
}



app.get('/ct/latest', function(req, res) {
  fs.readdir('./ct', function(err, files) {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
    incrementDownload();

    // Extract version number and the full file name from each file, and store in an array of arrays
    let versionedFiles = files.map(file => {
      let versionMatch = file.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        return [versionMatch[0], file];
      } else {
        return null;
      }
    }).filter(file => file !== null); // Filter out any bundle that do not include a version number

    let latestFileVersion = getLatestFile(versionedFiles);
    let latestFile = './ct/' + latestFileVersion;

    console.log('Attempting to download file from path:', latestFile);
    if (fs.existsSync(latestFile)) {
      res.download(latestFile); // Deliver the file for download
    } else {
      res.status(404).send('File not found or no latest version available.');
    }
  });
});

// Adjust the getLatestFile to handle our different data structure
function getLatestFile(files) {
  // Sort the array to have highest version number first
  let sortedByVersion = files.sort((a, b) => semver.rcompare(a[0], b[0]));

  // Return the full file name of the latest version
  return sortedByVersion.length > 0 ? sortedByVersion[0][1] : null;
}

app.get('/ct/previous', function(req, res) {
  fs.readdir('./ct', function(err, files) {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
    incrementDownload();

    // Extract version number and the full file name from each file, and store in an array of arrays
    let versionedFiles = files.map(file => {
      let versionMatch = file.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        return [versionMatch[0], file];
      } else {
        return null;
      }
    }).filter(file => file !== null); // Filter out any bundle that do not include a version number

    let previousFileVersion = getPreviousFile(versionedFiles);
    let previousFile = './ct/' + previousFileVersion;

    console.log('Attempting to download file from path:', previousFile);
    if (fs.existsSync(previousFile)) {
      res.download(previousFile); // Deliver the file for download
    } else {
      res.status(404).send('File not found or no previous version available.');
    }
  });
});

// getPreviousFile function to handle the data structure
function getPreviousFile(files) {
  // Sort the array to have highest version number first
  let sortedByVersion = files.sort((a, b) => semver.rcompare(a[0], b[0]));

  // Return the full file name of the previous version
  return sortedByVersion.length > 1 ? sortedByVersion[1][1] : null;
}

app.get('/bundle/latest', function(req, res) {
  fs.readdir('./bundle', function(err, files) {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
    incrementDownload();

    // Extract version number and the full file name from each file, and store in an array of arrays
    let versionedFiles = files.map(file => {
      let versionMatch = file.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        return [versionMatch[0], file];
      } else {
        return null;
      }
    }).filter(file => file !== null); // Filter out any bundle that do not include a version number

    let latestFileVersion = getLatestFile(versionedFiles);
    let latestFile = './bundle/' + latestFileVersion;

    console.log('Attempting to download file from path:', latestFile);
    if (fs.existsSync(latestFile)) {
      res.download(latestFile); // Deliver the file for download
    } else {
      res.status(404).send('File not found or no latest version available.');
    }
  });
});

// Adjust the getLatestFile to handle our different data structure
function getLatestFile(files) {
  // Sort the array to have highest version number first
  let sortedByVersion = files.sort((a, b) => semver.rcompare(a[0], b[0]));

  // Return the full file name of the latest version
  return sortedByVersion.length > 0 ? sortedByVersion[0][1] : null;
}

app.get('/bundle/previous', function(req, res) {
  fs.readdir('./bundle', function(err, files) {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
    incrementDownload();

    // Extract version number and the full file name from each file, and store in an array of arrays
    let versionedFiles = files.map(file => {
      let versionMatch = file.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        return [versionMatch[0], file];
      } else {
        return null;
      }
    }).filter(file => file !== null); // Filter out any bundle that do not include a version number

    let previousFileVersion = getPreviousFile(versionedFiles);
    let previousFile = './bundle/' + previousFileVersion;

    console.log('Attempting to download file from path:', previousFile);
    if (fs.existsSync(previousFile)) {
      res.download(previousFile); // Deliver the file for download
    } else {
      res.status(404).send('File not found or no previous version available.');
    }
  });
});

// getPreviousFile function to handle the data structure
function getPreviousFile(files) {
  // Sort the array to have highest version number first
  let sortedByVersion = files.sort((a, b) => semver.rcompare(a[0], b[0]));

  // Return the full file name of the previous version
  return sortedByVersion.length > 1 ? sortedByVersion[1][1] : null;
}

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