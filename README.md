# travisci-webhook

A flexible web server for reacting to Travis CI Webhooks.

Inspired by [github-webhook](https://github.com/rvagg/github-webhook).

## Example

```text
travisci-webhook \
  --port=9999 \
  --path=/webhook \
  --token=mytravistoken \
  --log=/var/log/webhook.log \
  --rule [ --event=success --match='branch == master' --exec='echo yay!' ]
```

You can also specify a `--config <file>` where *file* is a JSON file containing the same properties as are available as commandline options. The commandline will always override properties in the config file though.

```json
{
  "port": 9999,
  "path": "/webhook",
  "token": "mytravistoken",
  "log": "/var/log/webhook.log",
  "rules": [{
    "event": "success",
    "match": "branch == \"master\" && repository.name == \"myrepo\"",
    "exec": "echo yay!"
  }]
}
```

## Options

* **port** (required): the port for the server to listen to (also respects `PORT` env var)
* **path** (required): the path / route to listen to webhook requests on, should match what you tell GitHub
* **token** (required): the key used to hash the payload by Travis CI that we verify against
* **host** (optional): if you want to restrict `listen()` to a specific host
* **log** (optional): a file to print logs to, each command execution will be logged, also note that you can set the `DEBUG` env var to see debug output (see [debug](https://github.com/visionmedia/debug))
* **rules** (optional): an array of objects representing rules to match against and commands to execute, can also be supplied as individual `--rule` commandline arguments

### Rules

When reacting to valid Travis CI Webhook payloads, you can specify any number of rules that will be matched and execute commands in a forked shell. Rules have three components:

* `"event"`: the event type to match, one of the following: `"success"`, `"failure"`, `"start"`
* `"match"`: a basic object matching rule that will be applied against the payload received from GitHub. Should be flexible enough to match very specific parts of the PayLoad. See [matchme](https://github.com/DamonOehlman/matchme) for how this works.
* `"exec"`: a system command to execute if this rule is matched. **Note**: if you provide a string it will be run with `sh -c "<string>"` (unlikely to be Windows-friendly), however if you provide an array of strings then the first element will be executed with the remaining elements as its arguments.

You can either specify these rules in an array on the `"rules"` property in the config file, or as separate `--rule` commandline arguments where the components use the subarg syntax, e.g.: `--rule [ --event='' --match='' --exec='']` (you will generally want to quote the rule to prevent shell trickery).

## Programatic usage

You can `var server = require('travisci-webhook')(options)` and you'll receive a `http.Server` object that has been prepared but not started.

## More information

**travisci-webhook** is powered by [travisci-webhook-handler](https://github.com/chrisjaure/travisci-webhook-handler), see that for more details.

## License

**github-webhook** is Copyright (c) 2015 Chris Jaure and licensed under the MIT License. All rights not explicitly granted in the MIT License are reserved. See the included [LICENSE](./LICENSE) file for more details.
