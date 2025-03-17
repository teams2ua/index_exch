"use strict"
const state = require('../src/state');

let m = new Map();
m.set(4, 3);
console.log(m.get(4));
console.log(m.has(3));
console.log(JSON.stringify(Array.from(m)));
const st = new state.State({}, {});
const newSt = new state.State(st.indexes, st.orderBook + 4);
console.log(st);
console.log(newSt);

function ss()
{
    return 4, {};
}

const y = ss();
console.log(y);