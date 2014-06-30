// initialize the app
module.exports = function(imports, modular) {
  // registers a new module
  modular.provides('world')
    .on('start', function() {
      imports.web.app.instance().get(
        '/', function(req, res) {
          res.end('Hello World - from hello');
        }
      );
    })
  ;
};