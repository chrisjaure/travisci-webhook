var test = require('tape');
var fs = require('fs');
var crypto = require('crypto');
var supertest = require('supertest');
var webhook = require('./');

function signRequest (repoSlug, userToken) {
    return crypto.createHash('sha256').update(repoSlug + userToken).digest('hex');
}

test('invalid url gets 404', function(t) {
    t.plan(1);

    var options = {
        port: 0,
        path: '/webhook',
        token: 'foofaa'
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
        token: 'foofaa'
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
        token: 'foofaa'
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
        .set('Authorization', signRequest('test', 'foofaa'))
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
        token: 'foofaa',
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
        .set('Authorization', signRequest('test', 'foofaa'))
        .set('Travis-Repo-Slug', 'test')
        .send(json)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err) {
            t.error(err);
        });

});
