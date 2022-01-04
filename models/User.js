const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
const md5 = require('md5');
const validator = require('validator');
//In our schema, the validate validation, will give us a "nice readabl" error. Since we also have a unique: true, that will return an "ugly" mongodb error. By adding this plugin to our schema, it will change those ugly mongodb errors to something nicer.
//More info at: https://www.npmjs.com/package/mongoose-mongodb-errors
const mongodbErrorHandler = require('mongoose-mongodb-errors');
//Easily create user accounts without doing a lot of boilerplate.
//It will take care of ading the additional fields to our schema as well as adding the additonal methods to create the logins.
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
    email: {
        type: String,
        unique: true,
        lowerCase: true, // whenever someone submits an email, it will be automatically lowercased
        trim: true, //take off any spaces at the beginnig and the end of the string
        validate: [validator.isEmail, 'Invalid Email Address'], //Custom validation to make sure this is a proper email. You pass it 2 things: 1. How to validate it, 2. Error message if it fails validation
        required: 'Please supply an email address'
    },
    name: {
        type: String,
        required: 'Please supply a name',
        trim: true
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    //We are telling monogdb that hearts are going to be an array of ids that are related to a store. That way when we populate our hearts we are going to see all of the stores in this actual hearts not just the list of ids.
    //This is really an array of objects.
    hearts: [
        { type: mongoose.Schema.ObjectId, ref: 'Store' }
    ]
});

//Gravatar => Globally recognized avatar. Esentially what it does is every single time that you have a users email address, you can actually get their avatar from it. We are not going to be handling users uploading images as their avatars. We are going to use the built in gravatar service.
//We don't need to add a new property called gravatar to our User schema, because it can be used with whats called a virtual field.
//A virtual field in mongoose is essentially something that can be generated. Rather than storing all the data about your users, sometimes it can be generated. E.g. If you are storing the weight of your users, and you have it in kg, you wouldn't have to also store it in pounds because that can just be generated on the fly. If you have it one you can convert it to the other no problem.
userSchema.virtual('gravatar').get(function() {
    //A gravatar uses a hashing algorithm called md5. Esentially it just takes the user's email address and hashes it, so that you are not going to leak the user's email address in the image source.
    const hash = md5(this.email);
    return `https://gravatar.com/avatar/${hash}?s=200`;
}); //We can have both a get and set function. In our case we only need a get.


//Add the fields and methods that are needed to use authentication, and I want to use "email" as our login field.
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
userSchema.plugin(mongodbErrorHandler);

module.exports = mongoose.model('User', userSchema);