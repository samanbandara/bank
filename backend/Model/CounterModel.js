const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const CounterSchema = new Schema({
    counterid: {
        type: String,
        required: true
    },
    countername: {
        type: String,
        required: true
    },
    counterservices: {
        type: [String],
        required: true
    }
});

module.exports = mongoose.model(
    'CounterModel', // model name
    CounterSchema,  // schema
    'counters'      // explicit MongoDB collection name
);
