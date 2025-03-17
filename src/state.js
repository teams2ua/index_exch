"use strict"

module.exports = {
    OrderBook: function(buys, sells) {
        this.buys = buys;
        this.sells = sells;
        Object.freeze(this);
    },
    State: function (indexes, orderBook, currentPrices) {
        this.indexes = indexes;
        this.orderBook = orderBook;
        this.currentPrices = currentPrices;
        Object.freeze(this);
    }
}
