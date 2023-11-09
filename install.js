var fs = require("fs");
var tar = require("tar");
var zlib = require("zlib");
var unzip = require("unzip-stream");
var path = require("path");
var pipeline = require('node:stream/promises').pipeline;
var https = require('follow-redirects').https;

var packageInfo = require(path.join(process.cwd(), "package.json"));
var version = packageInfo.version;

var binName = process.argv[2];
var os = process.argv[3] || process.platform;
var arch = process.argv[4] || process.arch;
var root = `https://github.com/SAP/${binName}/releases/download/v${version}/${binName}_${version}_`;


var requested = os + "-" + arch;
var current = process.platform + "-" + process.arch;
if (requested !== current ) {
  console.error("WARNING: Installing binaries for the requested platform (" + requested + ") instead of for the actual platform (" + current + ").")
}

var unpackedBinPath = path.join(process.cwd(), "unpacked_bin");
var config = {
  dirname: __dirname,
  binaries: [
      'mta'
  ],
  urls: {
      'darwin-arm64': root + 'Darwin_arm64.tar.gz',
      'darwin-x64': root + 'Darwin_amd64.tar.gz',
      'linux-x64': root + 'Linux_amd64.tar.gz',
      'linux-arm64': root + 'Linux_arm64.tar.gz',
      'win32-x64': root + 'Windows_amd64.tar.gz'
  }
};

var binExt = "";
if (os == "win32") {
  binExt = ".exe";
}

var buildId = os + "-" + arch;
var url = config.urls[buildId];
if (!url) {
  throw new Error("No binaries are available for your platform: " + buildId);
}
function httpsGet(url, resolve, reject) {
  https.get(url, res => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      resolve(res);
    } else {
      reject(null, res);
    }
  }).on('errer', e => {
    reject(e, res);
  });
}
function binstall(url, path) {
  if (url.endsWith(".zip")) {
    return unzipUrl(url, path);
  } else {
    return untgz(url, path);
  }
}

function untgz(url, path) {
  return new Promise(function (resolve, reject) {
    var untar = tar
      .x({ cwd: path })
      .on("error", function (error) {
        reject("Error extracting " + url + " - " + error);
      })
      .on("end", function () {
          resolve("Successfully downloaded and processed " + url);
      });

    var gunzip = zlib.createGunzip().on("error", function (error) {
      reject("Error decompressing " + url + " " + error);
    });

    try {
      fs.mkdirSync(path);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }

    httpsGet(url, readStream => {
      pipeline(readStream, gunzip, untar);
    }, (error, res) => {
      if (error) {
        console.error(error.message);
      } else {
        console.error("Status Code: " + res.statusCode);
      }
    });
  });
}

function unzipUrl(url, path) {
  return new Promise(function (resolve, reject) {
    var writeStream = unzip
      .Extract({ path: path })
      .on("error", function (error) {
        reject("Error extracting " + url + " - " + error);
      })
      .on("entry", function (entry) {
        console.log("Entry: " + entry.path);
      })
      .on("close", function () {
        var successMessage = "Successfully downloaded and processed " + url

        resolve(successMessage);
      
      });


    httpsGet(url, readStream => {
      pipeline(readStream, writeStream);
    }, (error, res) => {
      if (error) {
        console.error(error.message);
      } else {
        console.error("Status Code: " + res.statusCode);
      }
    });
  });
}

binstall(url, unpackedBinPath).then(function() {
  config.binaries.forEach(function(bin) {
    fs.chmodSync(path.join(unpackedBinPath, bin + binExt), "755");
  });
}).then(function(result) {
  process.exit(0);
}, function(result) {
  console.error("ERR", result);
  process.exit(1);
});
