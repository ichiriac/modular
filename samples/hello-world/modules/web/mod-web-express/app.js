
// initialize the app
module.exports = function(imports, modulable) {

  var app;

  // registers a new module
  modulable.provides('app')
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
  modulable.extends('app', function(parent) {
    this.method('listen', function() {
      parent.listen();
    });
  });

};