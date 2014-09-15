var fs = require("fs");
var path = require("path");
var dateUtils = require("date-utils");
var LineStream = require('byline').LineStream;

var config = require("../config/config");
var utils = require("./Utils");

function HostDocReader(hostDir) {
  this.hostDir = hostDir;
  this.files = fs.readdirSync(hostDir);
};

HostDocReader.prototype = {
  next: function(cb) {
    if (this.files.length == 0) {
      // execute callback when function exists
      setTimeout(function() {cb(null);}, 0);
      return;
    }
    // otherwise pick the next file and process it
    var file = this.files.pop();
    var docArray = [];
    var input = fs.createReadStream(path.join(this.hostDir, file));
    var lineStream = new LineStream();
    lineStream.on('data', function(line) {
      try {
        var doc = JSON.parse(line);
        docArray.push(doc);
      } catch (e) {}
    });
    lineStream.on('end', function() {
      // execute callback when function exists
      setTimeout(function() {cb(docArray);}, 0);
    });
    input.pipe(lineStream);
  },
};

HostSaver = {
  init: function() {
    utils.ensureDirectory(path.join(config.rootDir, config.workDir));
    this.outputDir = path.join(config.rootDir, config.workDir, config.download.hostsOutputDir);
    utils.ensureDirectory(this.outputDir);
    this.collector = {};
  },

  clear: function(cb) {
    require('child_process').exec('/bin/rm -rf ' + this.outputDir, function(err, stdout, stderr) {
      if (err) throw err;
      if (cb) cb();
    });
  },

  consume: function(doc) {
    if (doc.host) {
      if (!this.collector[doc.host]) {
        this.collector[doc.host] = [];
      }
      this.collector[doc.host].push(doc);
    }
  },

  flush: function() {
    Object.keys(this.collector).forEach(function(host) {
      this.flushHost(host);
    }.bind(this));
    this.collector = {};
  },

  flushHost: function(host) {
    // make surte host directory exists
    var hostDir = path.join(this.outputDir, host);
    utils.ensureDirectory(hostDir);
    var docs = this.collector[host];
    var fileHolder = {};
    docs.forEach(function(doc) {
      var harvestDate = new Date(doc.harvested*1000);
      var file = path.join(hostDir, harvestDate.toFormat("YYYY.MM.DD"));
      if (!fileHolder[file]) {
        fileHolder[file] = fs.openSync(file, "a+");
      }
      fs.writeSync(fileHolder[file], JSON.stringify(doc));
      fs.writeSync(fileHolder[file], "\n");
    }.bind(this));

    Object.keys(fileHolder).forEach(function(file) {
      fs.closeSync(fileHolder[file]);
    });
  },

  readHostDocs: function(host, cb) {
    var hostDir = path.join(this.outputDir, host);
    if (!fs.existsSync(hostDir)) {
      cb(null);
      return;
    }

    // readin data files
    var files = fs.readdirSync(hostDir);
    var finished = 0;
    files.forEach(function(file) {
      var input = fs.createReadStream(path.join(hostDir, file));
      var lineStream = new LineStream();
      lineStream.on('data', function(line) {
        try {
          cb(JSON.parse(line));
        } catch (e) {}
      });
      lineStream.on('end', function() {
        finished++;
        if (finished == files.length) {
          cb(null);
        }
      });
      input.pipe(lineStream);
    });
  },

  getHostDocReader: function(host) {
    var hostDir = path.join(this.outputDir, host);
    if (!fs.existsSync(hostDir)) return null;
    else                         return new HostDocReader(hostDir);
  },
};

module.exports = HostSaver;
