const passport = require('passport'); //library that we are using to log evertbody in.
const mongoose = require('mongoose');
const User = mongoose.model('User');
//Moudule built into node.js that will allow us to get cryptographically secure random strings. Since it's built into node, you don't have to npm install.
const crypto = require('crypto');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

//The ability to send passport data and tell us if we should be logged in or not. These are called strategies in passport.
//A strategy is something that will interface with checking if you are allowed to be logged in. So, there could be a strategy for facebook, that's going to check with facebook if they have the correct tokens.
//In our case, we are going to be using what is called a local strategy. Local strategy will check for username and password thats been sent in correctly.
//We are going to be creating a middleware, not with the normal (req, res) that we are used to, but we are going to be taking advantage of some of the middleware that comes with passport.
//Before using any of the strategies (like 'local') you need to configure them in our application. For example if the strategy is 'facebook', you'll need to give it the correct facebook tokens.
//For local strategy, you need to tell it what to do with the actual users, once they signed in; in our case it's going to put the user object on each request.
exports.login = passport.authenticate('local', {
    //config object that will tell us a bit of data about whats happening
    //1. If there is a failure, where should they go:
    failureRedirect: '/login',
    //2. Show message
    failureFlash: 'Failed Login!',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
    //passport.js adds these methods (like .logout()) that we can use.
    req.logout();
    req.flash('success', 'You are now logged out!');
    res.redirect('/');
}

exports.isLoggedIn = (req, res, next) => {
    //Check if user is authenticated
    //passport.js adds these methods (like .isAuthenticated()) that we can use.
    if(req.isAuthenticated()) {
        next(); //carry on, they are logged in
        return;
    }

    req.flash('error', 'Oops you must be logged in to do that!');
    res.redirect('/login');
};

exports.forgot = async (req, res) => {
    //1. See if user with that email exists.
    const user = await User.findOne({
        email: req.body.email
    });  
    if(!user) {
        //Showing the message 'No account with that email exists', has a possible security implementation where somebody could use this if they had a list of email addresses, who signed up for the site.
        //If you don't want to tell your user that no account exists with that email, some people just show them the message 'A password reset has been mailed to you.' even if it doesn't exist.
        //But for the sake of simplicity, and since would be a "private application", we are going to use the message 'No account with that email exists'.
        req.flash('error', 'No account with that email exists');
        return res.redirect('/login');;
    }
    //2. Set reset tokens and expiry on their account.
    //Add these two fileds to our User schema (resetPasswordToken and resetPasswordExpires).
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000 // 1 hr from now
    await user.save();
    //3. Send them an email with the token.
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
    await mail.send({
        user,
        filename: 'password-reset',
        subject: 'Password Reset',
        resetURL
    });
    req.flash('success', `You have been emailed a password reset link.`);
    //4. Redirect to login page.
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() } //$gt -> greater than; we are going to look for an expires that is greater than now, so we now that the token is still valid because it is in the future.
    });
    if(!user) {
        req.flash('error', 'Password reset token is invalid or has expired');
        res.redirect('/login');
    }
    //If there is a user show the reset password form
    res.render('reset', { title: 'Reset your Password' });
};

exports.confirmPasswords = (req, res, next) => {
    //To access a property on the body with a dash, you use square brackets.
    if(req.body.password === req.body['password-confirm']) {
        next(); //keep it going!
        return;
    }
    req.flash('error', 'Passwords do not match');
    res.redirect('back');
};

exports.update = async (req, res) => {
    //1. Find user and check if the reset password token is still valid
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() } //$gt -> greater than; we are going to look for an expires that is greater than now, so we now that the token is still valid because it is in the future.
    });
    if(!user) {
        req.flash('error', 'Password reset token is invalid or has expired');
        res.redirect('/login');
    }
    //This .setPassword() method is available to us because we are using that plugin on our User model.
    //However, .setPassword() is not promise based, its callback based so we'll make it promisifiable using promisify.
    const setPassword = promisify(user.setPassword, user);
    //This is going to set the new password, hash it, salt it etc
    await setPassword(req.body.password);
    //We need to get rid of resetPasswordToken and resetPasswordExpires. The way that you get rid of fields in mongodb is by setting them to undefined.
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updatedUser = await user.save();
    //Automatically logged them in after resetting password.
    //All of the packages (like passport.js) that we are using will give us access to these methods (like .login()) via the middleware that they introduced.
    //This .login() is a neat little part of passport.js, you can always pass it an actual user and it will just automatically log that person in without us having to pass it a username and password.
    await req.login(updatedUser);
    req.flash('success', 'Nice! Your password has been reset! You are now logged in!');
    res.redirect('/');
};