const mongoose = require('mongoose');
const User = mongoose.model('User'); // we can do this because we already imported it in start.js.
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
    res.render('login', { title: 'Login' });
};

exports.registerForm = (req, res) => {
    res.render('register', { title: 'Register' });
};

exports.validateRegister = (req, res, next) => {
    //Sanitize the name. Make sure they are not trying to sing up with any kind of script tags in it.
    //sanitizeBody comes from the imported expressValidator in app.js. 
    req.sanitizeBody('name');
    //Check that they actually supplied a name and email
    req.checkBody('name', 'You must supply a name!').notEmpty();
    req.checkBody('email', 'That email is not valid!').isEmail();
    //More info about express-validator: https://express-validator.github.io/docs/
    req.sanitizeBody('email').normalizeEmail({
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false
    });
    //Check password cannot be blank
    req.checkBody('password', 'Password cannot be blank!').notEmpty();
    req.checkBody('password-confirm', 'Confirm Password cannot be blank!').notEmpty();
    req.checkBody('password-confirm', 'Oops! Your passwords do not match!').equals(req.body.password);

    const errors = req.validationErrors();
    if(errors) {
        req.flash('error', errors.map(err => err.msg));
        res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
        return; //stop the fn from running.
    }

    next();//There were no errors and call the next middleware in line.
};

//The reason why we pass next is because this is going to be a middleware. This is not the end of the road. The end of the road is actually logging the user in.
exports.register = async (req, res, next) => {
    //We are not goinf to call .save in this; we are going to call .register.
    const user = new User({ email: req.body.email, name: req.body.name });
    //.register is the actual method that will take the password that we pass it, hash it and save it to our actual database.
    //.register method comes from the plugin passportLocalMongoose plugin that we added in the User model. This method takes care of all the lower level registration for us.
    //User.register(user); //This .register library doesn't return a promise, it;s callback based.
    //For that reason, we can use the promisify library to "convert" older callback based methods to promises so we can still use async-await.
    //Parameters for promisify: 1. The method that you want to promisify; 2. Because its a method, and not just a top level function you need to pass it which object to bind to. So, if you are using promisify library, if the method that you are trying to promisify lives on an object you also need to pass the entire object so it knows where tobind itself too.   
    const register = promisify(User.register, User);
    //Here the method is going to take the password and it's going to hash it. That hash is what it will store on the DB.
    await register(user, req.body.password);
    next(); // pass to authController.login
};

exports.account = (req, res) => {
    res.render('account', { title: 'Edit Your Account' });
}

exports.updateAccount = async (req, res) => {
    //Since we don't want to update the hash, we are going to make another variable to send the updated data.
    const updates = {
        name: req.body.name,
        email: req.body.email
    };

    //req.user is available to us because passport.js attaches it into every request.
    //findOneAndUpdate -> Query for specific user and then update it
    //findOneAndUpdate takes 3 parameters: 1. The query to look for the specific user; 2. The updates (new values), 3. Options (like return the new updated object, run the validators before updatind).
    const user = await User.findOneAndUpdate(
        { _id: req.user._id }, //req.user is available to us because passport.js attaches it into every request.
        { $set: updates }, //Will take the values from 'updates' and set it on top of what already exists.
        { new: true, runValidators: true, context: 'query' } //context is required for mongoose to actually do the query properly.
    );

    req.flash('success', 'Updated the profile!');
    //'back' will redirect you to the url that you came from. This is helpful is this was ever working on multiple endpoints.
    res.redirect('back');
};