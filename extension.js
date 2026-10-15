'use strict';
const { Controller } = require('./src/controller');

let controller;

function activate(context) {
    controller = new Controller(context);
    context.subscriptions.push(controller);
    controller.register();
}

function deactivate() {
    if (controller) {
        controller.dispose();
        controller = undefined;
    }
}

module.exports = { activate, deactivate };
