"use strict"
const state = require('../src/state');
const solver = require('../src/solver');

const assert = require('assert');

describe("Solver", function () {
    it("should match orders", function () {
        const orderBook = new state.OrderBook(
            // buys
            [
                new state.OrderInBook(1, 10, 10),
                new state.OrderInBook(2, 10, 7),
                new state.OrderInBook(3, 10, 5),
                new state.OrderInBook(4, 10, 1)
            ],
            // sells
            [
                new state.OrderInBook(5, 5, 3),
                new state.OrderInBook(6, 6, 4),
                new state.OrderInBook(7, 11, 6),
                new state.OrderInBook(8, 10, 11)
            ]
        );
        let res = solver.solveSameIndexOrderBook(orderBook);
        assert.deepEqual(res.newOrderBook, new state.OrderBook(
            [
                new state.OrderInBook(3, 10, 5),
                new state.OrderInBook(4, 10, 1)
            ],
            [
                new state.OrderInBook(7, 2, 6),
                new state.OrderInBook(8, 10, 11)
            ]
        ));
        assert.deepEqual(res.fillResponses,
            [
                new state.FillOrder(5, 5, 0),
                new state.FillOrder(1, 10, 0),
                new state.FillOrder(6, 6, 0),
                new state.FillOrder(2, 10, 0),
                new state.FillOrder(7, 9, 2)
            ]);
        assert.strictEqual(res.marginProfit, 77);
    });
});