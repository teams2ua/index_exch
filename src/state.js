"use strict"

module.exports = {
    OrderInBook: function (id, qty, price) {
        if (qty <= 0)
            throw new RangeError(format("Qty should be > 0, got {0} for order id {1}", qty, id));
        this.id = id;
        this.qty = qty;
        this.price = price;
        Object.freeze(this);
    },
    OrderBook: function (buys, sells) {
        if (!(buys.every((val, i, buys) => i === 0 || buys[i - 1].price >= val.price)))
            throw new Error("Buy prices should de sorted desc");
        if (!(sells.every((val, i, sells) => i === 0 || sells[i - 1].price <= val.price)))
            throw new Error("Sell prices should de sorted asc");
        this.buys = buys;
        this.sells = sells;
        Object.freeze(this);
    },
    IndexState: function (indexDef, orderBook) {
        this.indexDef = indexDef; // JS Map assetName => qty
        this.orderBook = orderBook;
        Object.freeze(this);
    },
    State: function (indexes, currentPrices) {
        this.indexes = indexes;
        this.currentPrices = currentPrices;
        Object.freeze(this);
    },
    FillOrder: function (id, qty, remainingQty) {
        this.id = id;
        this.qty = qty;
        this.remainingQty = remainingQty;
        Object.freeze();
    }
}
