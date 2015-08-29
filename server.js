var http = require('http');
var fs = require('fs');
var spawn = require('child_process').spawn;
var createHandler = require('travisci-webhook-handler');
var debug = require('debug');
var matchme = require('matchme');
var split2 = require('split2');
var through2 = require('through2');
var serverDebug = debug('travisci-webhook:server');
var eventsDebug = debug('travisci-webhook:events');

function createServer(options) {
    if (options.port === undefined) {
        throw new TypeError('must provide a \'port\' option');
    }

    if (!Array.isArray(options.rules)) {
        options.rules = [];
    }

    var server = http.createServer();
    var handler = createHandler(options);
    var logStream = options.log && fs.createWriteStream(options.log);

    server.webhookHandler = handler;

    server.on('request', function(req, res) {
        serverDebug('Connection from ' + req.socket.address().address + ':' + req.socket.address().port);

        handler(req, res, function(err) {
            function response(code, msg) {

                var address = req.socket.address();
                serverDebug('Response to %s:%s: %d "%s"', address ? address.address : 'unknown', address ? address.port : '??', code, msg);

                res.writeHead(code, {
                    'content-type': 'text/json'
                });
                res.end(JSON.stringify({
                    error: msg
                }));
            }

            if (err) {
                return response(500, 'Internal server error: ' + err.message);
            }

            response(404, 'Resource not found on this server');
        });
    });

    server.on('listening', function (err) {
        if (err) {
            throw err;
        }
        serverDebug('Listening on http://' + this.address().address + ':' + this.address().port);
    });

    handler.on('error', function(err) {
        eventsDebug('Non-fatal error: ' + JSON.stringify(err.message));
    });

    ['success', 'failure', 'start'].forEach(function(key) {
        handler.on(key, function(event) {
            eventsDebug(JSON.stringify(event));
            handleRules(logStream, options.rules, event);
        });
    });

    return server;
}


function prefixStream(stream, prefix) {
    return stream.pipe(split2()).pipe(through2(function(data, enc, callback) {
        callback(null, prefix + data + '\n');
    }));
}


function handleRules(logStream, rules, event) {
    function executeRule(rule) {
        if (rule.executing === true) {
            rule.queued = true; // we're busy working on this rule, queue up another run
            return;
        }

        rule.executing = true;

        var startTs = Date.now();
        var eventStr = 'event="' + rule.event + '", match="' + rule.match + '", exec="' + rule.exec + '"';
        var exec = Array.isArray(rule.exec) ? rule.exec : ['sh', '-c', rule.exec];
        var cp;

        eventsDebug('Matched rule for %s', eventStr);

        cp = spawn(exec.shift(), exec, {
            env: process.env
        });

        cp.on('error', function(err) {
            return eventsDebug('Error executing command [%s]: %s', rule.exec, err.message);
        });

        cp.on('close', function(code) {
            eventsDebug('Executed command [%s] exited with [%d]', rule.exec, code);

            if (logStream) {
                logStream.write(eventStr + '\n');
                logStream.write(new Date() + '\n');
                logStream.write('Took ' + (Date.now() - startTs) + ' ms\n');
            }

            rule.executing = false;
            if (rule.queued === true) {
                rule.queued = false;
                executeRule(rule); // do it again!
            }
        });

        if (logStream) {
            prefixStream(cp.stdout, 'stdout: ').pipe(logStream, {
                end: false
            });
            prefixStream(cp.stderr, 'stderr: ').pipe(logStream, {
                end: false
            });
        }
    }

    rules.forEach(function(rule) {
        if (rule.event != '*' && rule.event != event.event) {
            return;
        }

        if (!matchme(event.payload, rule.match)) {
            return;
        }

        executeRule(rule);
    });
}

module.exports = createServer;
