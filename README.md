Modular
=======

Modular is the easy way to bootstrap and create an modular, customisable and extensible
applications.

The main principle of this plugin is :

 - everything is a module
 - a module is typed (belongs to module container)
 - a package provides and/or use a list of modules
 - you app loads modules
 - you must use a standard sequence of events to launch core modules (bootstrap)

Modular is strongly based on NPM, and provides a common layer between
the app it's modules and common NodeJS components like express, swig, etc ...

The main goals are :

1. Have a common interface over components, that lets you build apps more easily : chose a framework and gogogo

2. Make an open and modular app by enabling others to provide plugins

# Sample code

A common way to start an application :

```
// initialize the application
var app = require('modular')(
  // the application structure
  __dirname + '/package.json'
  // inject some application specific configuration
  , __dirname + '/config.json'
);

// run the application :
app
  // initialize the http mode
  .trigger('web', 'init')
  // initialize each plugin
  .trigger('plugin', 'start')
  // starts the application in http mode
  .trigger('web', 'start')
;
```

# Install

At first install the modular NPM package as a global script, that will add some
extra cli powers :

```
npm install modular -g
```

Go to the root of your project, and initialize your project with modular :

```
modular --init
```

This command will :

- create (or check) the package.json file
- update the package.json file with a modular configuration
- create an empty config.json file
- create a default app.js file if not exists

After this setup, you will be able to add some extra packages :

```
modular install mod-core-express --save
modular install mod-core-swig --save
```

And also create some plugins for your app :

```
modular create plugin:hello --save
modular create plugin:world --save
```

---

The work is still in progress here ...