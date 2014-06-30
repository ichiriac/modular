
// initialize the app
module.exports = function(imports, modular) {

  var app;

  // registers a new module
  modular.provides('app')
    .on('init', function() {
      console.log('to do ...');
    })
    .on('listen', function() {
      this.listen;
    })
    .method('listen', function(port) {
      app.listen(port);
    })
    .method('instance', function() {
      return app;
    })
  ;

  // extends an existing module
  modular.extends('app', function(parent) {
    this.method('listen', function() {
      parent.listen();
    });
  });

};