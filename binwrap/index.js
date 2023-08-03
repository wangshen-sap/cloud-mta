var path = require("path");
var install = require("./install");
var prepare = require("./prepare");

module.exports = function(config) {
  var paths = {};
  config.binaries.forEach(function(binary) {
    paths[binary] = path.resolve(path.join(config.dirname, "bin", binary));
  });
  return {
    paths: paths,
    install: function(unpackedBinPath, os, arch) {
      return install(config, unpackedBinPath, os, arch);
    },
    prepare: function() {
      return prepare(config);
    }
  };
};
