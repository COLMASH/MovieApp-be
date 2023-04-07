const mongoose = require('mongoose')

const FavoriteSchema = mongoose.Schema({
    imdbID: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now()
    },
    users: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }
})

module.exports = mongoose.model('Favorite', FavoriteSchema)
