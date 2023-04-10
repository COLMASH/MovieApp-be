const AWS = require('aws-sdk')
const secretsmanager = new AWS.SecretsManager()
AWS.config.update({ region: `${process.env.AWS_REGION}` })

const mongoose = require('mongoose')
require('dotenv').config({ path: 'variables.env' })

const connectDB = async () => {
    try {
        const mongoDBSecretArn = process.env.DB_MONGO
        const secretsmanagerResponse = await secretsmanager.getSecretValue({ SecretId: mongoDBSecretArn }).promise()
        const mongoDBSecret = await secretsmanagerResponse
        const secretString = JSON.parse(mongoDBSecret.SecretString)
        await mongoose.connect(secretString['movie-app-mongo'])
        console.log('DB Connected!')
    } catch (error) {
        console.log('Something went wrong')
        console.log(error)
        process.exit(1)
    }
}

module.exports = connectDB
