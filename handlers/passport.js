//Handler that will configure our actual passport.js
const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

//.createStartegy() is also a method that comes from the plugin that we added in our model User.js.
passport.use(User.createStrategy());

//Then we need to tell passport what to do with the actual user. Because whats going to happen is, we are agoing to log in to passport and it's going to say... Ok, now what? What information would you like on each request?
//In our case, we just want to pass along the user object so we can do things like put their avatar on the top right corner, show the stores that they created ect.
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
