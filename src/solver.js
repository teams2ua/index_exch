"use strict"
const state = require('./state');

class SameOrderBookSolverResult {
    constructor(newOrderBook, fillResponses, marginProfit) {
        this.newOrderBook = newOrderBook;
        this.fillResponses = fillResponses;
        this.marginProfit = marginProfit;
        Object.freeze(this);
    }
}

function getRemainingOrders(originalOrders, lastIndex, notUsedQty, fills) {
    if (lastIndex >= originalOrders.length)
        return [];
    if (notUsedQty < originalOrders[lastIndex].qty) {
        // partill fill
        fills.push(new state.FillOrder(
            originalOrders[lastIndex].id,
            originalOrders[lastIndex].qty - notUsedQty,
            notUsedQty));
        return [new state.OrderInBook(
            originalOrders[lastIndex].id,
            notUsedQty,
            originalOrders[lastIndex].price),
             ...originalOrders.slice(lastIndex + 1)];
    }
    return [...originalOrders.slice(lastIndex)];
}

function solveSameIndexOrderBook(orderBook) {
    if (orderBook.buys.length === 0 || orderBook.sells.length === 0)
        return new SameOrderBookSolverResult(orderBook, [], 0);
    let buyIdx = 0;
    let currentQtyToBuy = orderBook.buys[0].qty;
    let sellIdx = 0;
    let currentQtyToSell = orderBook.sells[0].qty;
    let fills = [];
    let marginProfit = 0;
    while (buyIdx < orderBook.buys.length
        && sellIdx < orderBook.sells.length
        && orderBook.buys[buyIdx].price >= orderBook.sells[sellIdx].price) {
        const qtyToFill = Math.min(currentQtyToBuy, currentQtyToSell);
        currentQtyToBuy -= qtyToFill;
        currentQtyToSell -= qtyToFill;
        marginProfit += (orderBook.buys[buyIdx].price - orderBook.sells[sellIdx].price) * qtyToFill;
        if (currentQtyToBuy === 0) {
            // complete fill
            fills.push(new state.FillOrder(
                orderBook.buys[buyIdx].id,
                orderBook.buys[buyIdx].qty,
                0));
            buyIdx++;
            if (buyIdx < orderBook.buys.length)
                currentQtyToBuy = orderBook.buys[buyIdx].qty;
        }
        if (currentQtyToSell === 0) {
            // complete fill
            fills.push(new state.FillOrder(
                orderBook.sells[sellIdx].id,
                orderBook.sells[sellIdx].qty,
                0));
            sellIdx++;
            if (sellIdx < orderBook.sells.length)
                currentQtyToSell = orderBook.sells[sellIdx].qty;
        }
    }
    return new SameOrderBookSolverResult(
        new state.OrderBook(
            getRemainingOrders(orderBook.buys, buyIdx, currentQtyToBuy, fills),
            getRemainingOrders(orderBook.sells, sellIdx, currentQtyToSell, fills)),
        fills,
        marginProfit);
}

class SolveResult {
    constructor(newState, fillResponses, liquidityRequests) {
        this.newState = newState;
        this.fillResponses = fillResponses;
        this.liquidityRequests = liquidityRequests;
        Object.freeze(this);
    }
}

function solveState(state) {

    solveSameIndexOrderBook();
    return SolveResult(new state.State(),);
}

module.exports = {
    solveSameIndexOrderBook: solveSameIndexOrderBook,
    solveState: solveState
}