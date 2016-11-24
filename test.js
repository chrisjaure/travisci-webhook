var test = require('tape');
var fs = require('fs');
var supertest = require('supertest');
var webhook = require('./');
var NodeRSA = require('node-rsa');

var key = new NodeRSA({b: 1024}, {signingScheme: 'sha1'});
var public_key = key.exportKey('public');

function signRequest (obj) {
    return key.sign(obj, 'base64', 'base64');
}

test('invalid url gets 404', function(t) {
    t.plan(1);

    var options = {
        port: 0,
        path: '/webhook',
        public_key: public_key
    };
    var server = webhook(options);

    supertest(server)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(404)
        .end(function(err) {
            t.error(err);
        });

});


test('valid url, incomplete data gets 400', function(t) {
    t.plan(1);

    var options = {
        port: 0,
        path: '/webhook',
        public_key: public_key
    };
    var server = webhook(options);

    supertest(server)
        .get('/webhook')
        .expect('Content-Type', /json/)
        .expect(400)
        .end(function(err) {
            t.error(err);
        });

});


test('valid url, complete data gets 200', function(t) {
    t.plan(3);

    var options = {
        port: 0,
        path: '/webhook',
        public_key: public_key
    };
    var server = webhook(options);
    var obj = {
        status: 0
    };
    var json = 'payload=' + JSON.stringify(obj);
    var eventType = 'success';

    server.webhookHandler.on(eventType, function(event) {
        t.deepEqual(event.payload, obj, 'correct payload');
        t.equal(event.url, '/webhook', 'correct url');
    });

    supertest(server)
        .post('/webhook')
        .set('Signature', signRequest(obj))
        .set('Travis-Repo-Slug', 'test')
        .send(json)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err) {
            t.error(err);
        });

});


test('valid request triggers rule', function(t) {
    t.plan(6);

    var tmpfile = __dirname + '/__test_data.' + Math.random();
    var eventType = 'success';
    var options = {
        port: 0,
        path: '/webhook',
        public_key: public_key,
        rules: [{ // should not trigger this event
            event: eventType,
            match: 'branch == xxmaster',
            exec: 'echo "w00t!" > ' + tmpfile + '2'
        }, { // should trigger this event
            event: eventType,
            match: 'branch == "master"',
            exec: 'echo "w00t!" > ' + tmpfile
        }]
    };
    var server = webhook(options);
    var obj = {
        status: 0,
        branch: 'master'
    };
    var json = 'payload=' + JSON.stringify(obj);

    t.on('end', function() {
        fs.unlink(tmpfile, function() {});
    });

    server.webhookHandler.on(eventType, function(event) {
        t.deepEqual(event.payload, obj, 'correct payload');
        t.equal(event.url, '/webhook', 'correct url');
        setTimeout(function() {
            fs.readFile(tmpfile, 'utf8', function(err, data) {
                t.error(err);
                t.equal(data, 'w00t!\n');
            });
            fs.exists(tmpfile + '2', function(exists) {
                t.notOk(exists, 'does not exist, didn\'t trigger second event');
            });
        }, 100);
    });

    supertest(server)
        .post('/webhook')
        .set('Signature', signRequest(obj))
        .set('Travis-Repo-Slug', 'test')
        .send(json)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err) {
            t.error(err);
        });

});
