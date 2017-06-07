const app = require('express')();
const config = require('ez-config').get();
const ldap = require('ldapjs').createClient(config.ldap.server);
const cors = require('cors')();

var payload = {
  rows: null,
  corpus: null,
  init: function(corpus, item) {
    this.rows = [];
    if (!item) {
      this.rows.push({key:[corpus], value:{name:corpus}});
    }
    this.corpus = corpus;
  },
  push: function(entry) {
    var key = [this.corpus, entry[config.ldap.id]];
    for (var attribute in entry) {
      if (!(attribute in config.reserved.attributes || entry[attribute] in config.reserved.values)) {
        var value = {};
        value[config.hypertopic[attribute]||attribute] = entry[attribute];
        this.rows.push({ 
          key: key,
          value: value
        });
      }
    }
  },
  send: function(response) {
    response.json({rows: this.rows});
  }
};

function sendItems(request, response) {
  var filter =  '(' + config.ldap.class + '=' + request.params.corpus + ')';
  if (request.params.item) {
    filter = '(&' + filter + '('+ config.ldap.id + '=' + request.params.item + '))';
  }
  var options = {
    scope: 'sub', 
    filter: filter,
    attributes: config.ldap.attributes
  };
  payload.init(request.params.corpus, request.params.item);
  ldap.search(config.ldap.base, options, function(err, ldap_response) {
    ldap_response.on('searchEntry', function(entry) {
      payload.push(entry.object);
    });
    ldap_response.on('error', function(err) {
      console.error('error: ' + err.message);
    });
    ldap_response.on('end', function() {
      payload.send(response);
    });
  });
}

function sendAttributes(request, response) {
  var corpus = request.params.corpus;
  var rows = [];
  for (var attribute of config.ldap.attributes) {
    rows.push({key:[corpus, config.hypertopic[attribute]||attribute]});
  }
  response.json({rows:rows});
}

function sendAttributeValues(request, response){
  var corpus = request.params.corpus;
  var attribute = request.params.attribute;
  var filter = '(' + config.ldap.class + '=' + request.params.corpus + ')';
  filter ='(&' + filter + '(' + request.params.attribute + '=*' + request.params.value + '*))';

  var options = {
    scope: 'sub', 
    filter: filter,
    attributes: config.ldap.attributes
  };
  payload.init(request.params.corpus, request.params.attribute);
  ldap.search(config.ldap.base, options, function(err, ldap_response) {
    ldap_response.on('searchEntry', function(entry) {
      payload.push(entry.object);
    });
    ldap_response.on('error', function(err) {
      console.error('error: ' + err.message);
    });
    ldap_response.on('end', function() {
      payload.send(response);
    });
  });
}

app.use(cors)
.get(['/corpus/:corpus', '/item/:corpus/:item'], sendItems)
.get('/attribute/:corpus/', sendAttributes)
//.get('/attribute/:corpus/:attribute', sendAttributeValues)
.get('/attribute/:corpus/:attribute/:value', sendAttributeValues);

app.listen(config.port);
console.log('Server running on port ' + config.port);