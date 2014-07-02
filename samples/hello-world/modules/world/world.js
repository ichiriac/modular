// initialize the app
module.exports = function(imports, modulable) {
  // registers a new module
  modulable.provides('world')
    .on('start', function() {
      imports.web.app.instance().get(
        '/', function(req, res) {
          res.end('Hello World - from hello');
        }
      );
    })
  ;
};