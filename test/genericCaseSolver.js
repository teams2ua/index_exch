"use strict"
const state = require('../src/state');
const solver = require('../src/solver');

const assert = require('assert');

// index0 == a0 * 2 + a1 * 0 + a2 * 3
// index1 == a0 * 2 + a1 * 0 + a2 * 2
// index2 == a0 * 1 + a1 * 1 + a2 * 1
//
// order0: buy  2 of index0 at 100
// order1: buy  2 of index1 at 51
// order2: sell 5 of index2 at 1

describe("Generic solver", function () {
    it("should choose qtys of orders to maximize notional", async function () {

        let qtys = [2, 2, 5];
        let prices = [100, 51, 1];
        let assetCoef = [
            [-2, -2, 1],
            [0, 0, 1],
            [-3, -2, 1]
        ];
        let res = await solver.solveGenericCase(qtys, prices, assetCoef);
        assert.deepEqual(res, [1, 1, 5]);
    });
});