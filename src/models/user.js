const mongoose = require('mongoose')

const UserSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    created: {
        type: Date,
        default: Date.now()
    },
    favorites: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Favorite' }],
        default: []
    }
})

module.exports = mongoose.model('User', UserSchema)
