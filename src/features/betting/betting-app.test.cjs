const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

// Check that the exported prototype's interactions survived the React conversion.
const source = readFileSync(`${__dirname}/betting-app.jsx`, "utf8");
const logic = source.slice(source.indexOf("export default class"), source.indexOf("  render() {"))
  .replace("export default class BettingApp", "class BettingApp");
const context = { React: { Component: class {
  setState(update) { this.state = { ...this.state, ...update }; }
} } };
vm.createContext(context);
vm.runInContext(`${logic}}; globalThis.App = BettingApp;`, context);
const app = new context.App();
let values = app.renderVals();
assert.equal(values.shown.length, 6);
values.filters.find((filter) => filter.label === "BTC").go();
assert.equal(app.renderVals().shown.length, 2);
values.goCreate();
assert.equal(app.renderVals().isCreate, true);
values.lockCall();
assert.equal(app.renderVals().showWallet, true);
assert.equal(app.renderVals().locked, false);
values.connect();
app.renderVals().lockCall();
assert.equal(app.renderVals().locked, true);
values.shown[0].open();
assert.equal(app.renderVals().showSheet, true);
app.renderVals().acceptAction();
assert.equal(app.renderVals().accepted, true);
app.renderVals().closeSheet();
assert.equal(app.renderVals().showSheet, false);
console.log("Passed app state transitions.");
