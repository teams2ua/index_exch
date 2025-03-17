"use strict"
const state = require('./state');

class SolveSameOrderBookResult
{
    constructor(newOrderBook, fillResponses)
    {
        this.newOrderBook = newOrderBook;
        this.fillResponses = fillResponses;
        Object.freeze(this);
    }
}

function solveSameIndexOrderBook(orderBook)
{

}

class SolveResult
{
    constructor(newState, fillResponses, liquidityRequests)
    {
        this.newState = newState;
        this.fillResponses = fillResponses;
        this.liquidityRequests = liquidityRequests;
        Object.freeze(this);
    }
}

function solveState(state) {
    solveSameIndexOrderBook();
    return SolveResult(new state.State(), );
}

module.exports = {
    solveState: solveState
}