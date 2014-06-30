// initialize the app
module.exports = function(imports, modular) {
  console.log(imports);
  // registers a new module
  modular.provides('hello')
    .on('start', function() {
      imports.web.app.instance().get(
        '/', function(req, res) {
          res.end('Hello World - from hello');
        }
      );
    })
  ;
};