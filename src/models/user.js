const mongoose = require('mongoose')

const emailRegex =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

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
        match: [emailRegex, 'Invalid email'],
        unique: true,
        validate: [
            {
                validator(email) {
                    return mongoose.models.User.findOne({ email })
                        .then(user => {
                            return !user
                        })
                        .catch(() => false)
                },
                message: 'Email already in use'
            }
        ]
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
