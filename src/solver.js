"use strict"
const state = require('./state');
const z3Solver = require('z3-solver');

/*
Lets say we have K orders and N assets.
a[I][J] - is a qty of asset I in index of order J (could be 0)
we are making a[I][J] negative if the J order is BUY (we take liquidity)
x[J] - taken qty of order J

x[1] * a[1][1] + x[2] * a[1][2] + .. + x[K] * a[1][K] >= 0 
x[1] * a[2][1] + x[2] * a[2][2] + .. + x[K] * a[2][K] >= 0 
...
x[1] * a[N][1] + x[2] * a[N][2] + .. + x[K] * a[N][K] >= 0 
x[I] >= 1 and X[I] <= QTY[I] for all I >= 1 and I <= K
and we need to maximize function SUM(x[I] * price[I]) (maximize notional)
*/

async function solveGenericCase(inputQtys, inputPrices, assetCoef) {
    let ll = await z3Solver.init();
    const context = new ll.Context('main');

    // Create an optimization solver
    const opt = new context.Optimize();

    let x = context.Array.const('x', context.Int.sort(), context.Int.sort());
    let price = context.Array.const('p', context.Int.sort(), context.Int.sort());
    let qty = context.Array.const('q', context.Int.sort(), context.Int.sort());

    for (let idx = 0; idx < inputQtys.length; idx++) {
        price = price.store(idx, inputPrices[idx]);
        qty = qty.store(idx, inputQtys[idx]);

        // Sum of all x[i] * price[i] for optimization objective
        let assetValue = context.Int.val(0);
        for (let jdx = 0; jdx < assetCoef[idx].length; jdx++) {
            assetValue = context.Sum(assetValue, context.Product(x.select(jdx), context.Int.val(assetCoef[idx][jdx])));
        }
        opt.add(context.GE(assetValue, 0));
    }


    const i = context.Int.const('i');
    const j = context.Int.const('j');
    // Add constraints

    opt.add(context.ForAll([i], context.GE(x.select(i), 0))); // x1,x2.. xN ≥ 0
    opt.add(context.ForAll([i], context.GE(qty.select(i), x.select(i)))); // x1 <= qty1, x2 <=qty2,..., xN <= qtyN


    // Sum of all x[i] * price[i] for optimization objective
    let totalValue = context.Int.val(0);
    for (let idx = 0; idx < inputQtys.length; idx++) {
        totalValue = context.Sum(totalValue, context.Product(x.select(idx), price.select(idx)));
    }

    // Objective: Maximize totalValue
    opt.maximize(totalValue);

    // Solve the optimization problem
    if (await opt.check() === 'sat') {
        const model = opt.model();
        let res = [];
        for (let idx = 0; idx < inputPrices.length; idx++) {
            res.push(model.eval(x.select(idx)).value())
        }
        return res;
    } else {
        throw new Error("Some error happened");
    }
}

// pick assets that we have a chance to send to Binance
// maximizing notional
function liquidityRequestSolver() {

}

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

function getIndexPrice(indexDefinition, currentPrices) {
    let res = 0;
    for (const [assetName, assetQty] of indexDefinition) {
        res += currentPrices.get(assetName) * assetQty;
    }
    return res;
}

class SolveResult {
    constructor(newState, fillResponses, liquidityRequests) {
        this.newState = newState;
        this.fillResponses = fillResponses;
        this.liquidityRequests = liquidityRequests;
        Object.freeze(this);
    }
}

async function solveState(currentState, timestamp) {
    // 1. For each index do inner-index match
    let newIndexes = [];
    let fills = [];
    let marginGain = 0;
    for (const idx of currentState) {
        let res = solveSameIndexOrderBook(idx.orderBook);
        newIndexes.push(new state.IndexState(
            idx.indexDef,
            res.newOrderBook));
        marginGain += res.marginProfit;
        fills.push(...res.fillResponses);
    }
    // select orders that cross market price
    let crossingOrders = [];
    for (const idx of newIndexes) {
        let indexMarketPrice = getIndexPrice(idx.indexDef, currentState.currentPrices);
        
        for (const buyOrder of idx.orderBook.buys) {
            if (buyOrder.price < indexMarketPrice)
                break;
            crossingOrders.push([idx.indexDef, -1, buyOrder]);
        }
        for (const sellOrder of idx.orderBook.sells) {
            if (sellOrder.price > indexMarketPrice)
                break;
            crossingOrders.push([idx.indexDef, 1, sellOrder]);
        }
    }
    // trying to match order cross-index,
    // read comments for solveGenericCase function
    if (crossingOrders.length > 1) {
        // TODO: we could do "quantization" of prices and qtyes
        // to allow fractions - for this we nca delete price by some big constant
        // and multiply qty on the same constant
        let qtys = [];
        let prices = [];
        for (const [indexDef, sign, order] in crossingOrders) {
            qtys.push(order.qty);
            prices.push(order.price);
        }
        let assetCoef = [];
        for (const [assetName, price] of currentPrices) {
            let assetOrderQtys = [];
            for (const [indexDef, sign, order] in crossingOrders) {
                let val = indexDef.get(assetName);
                if (val === undefined)
                    assetOrderQtys.push(0);
                else
                    assetOrderQtys.push(val * sign);
            }
            assetCoef.push(assetOrderQtys);
        }
        // result should contain what amount we could fill
        // with current liquidity 
        let genericRes = await solveGenericCase(qtys, prices, assetCoef);
        console.log(genericRes);
        // TODO: Process genericRes - 
        //  * add fills
        //  * remove completely filled orders from crossingOrders
        //  * for partially and not filled order create list of assets
    }
    // TODO: look into liquidity requests history and understand how many assets could be sent
    // at this timestamp.
    // run liquidityRequestSolver()
    // if we assets to send does not cover all crossing orders
    // we put this orders back to orderBooks
    // liquidity request assign for each asset in request a list of orders
    // that need it, so we can attribute loses later.
    let liquidityRequests = [];
    return SolveResult(new state.State(), fills, liquidityRequests);
}

module.exports = {
    solveSameIndexOrderBook: solveSameIndexOrderBook,
    solveGenericCase: solveGenericCase,
    solveState: solveState,
    liquidityRequestSolver: liquidityRequestSolver
}