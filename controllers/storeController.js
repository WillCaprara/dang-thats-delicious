const mongoose = require('mongoose');
//Because we already imported it once (in start.js) we can refrence it from the mongoose property (because it uses singleton).
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
//Options to tell what happens with multer before we even make our middleware route.
const multerOptions = {
  //Where would the file be stored when it's uploaded
  storage: multer.memoryStorage(), //we will save it to memory because we don't want to keep the original uploaded file. We are going to read it into memory the resize it and save the resized version
  //What types of files are allowed
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/'); //Every file has its own mimetype to describe what type of file it is. We can't rely on the extension of the file to validate type.
    if(isPhoto) {
      next(null, true); //We will often see this callback premise in Node. If you call next and you pass it something as the first value that means it's an error. If you pass it null, true that means it worked and the second value is what will be passed through. 
    }
    else {
      next({ message: 'That filetype isn\'t allowed' }, false);
    }
  }
};
const jimp = require('jimp');
//Package to generate a unique id to make the file names unique
const uuid = require('uuid');
const { render } = require('pug');


exports.homePage = (req, res) => {
    res.render('index', { title: 'Dang' });
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

//We are looking for a single field thats called "photo".
exports.upload = multer(multerOptions).single('photo');

//The reason why we pass next to this function is because this is a middleware. We are not going to be doing any rendering or sending back to the client. We are just to be saving the image, recording the file name and passing it along to createStore.
exports.resize = async (req, res, next) => {
  //Check if there is no new file to resize.
  //multer will put the actual file onto the file property of the request. That's the whole point of a middleware, somene that came before you makes and preps some data for you.
  if(!req.file) {
    next(); //Skip to the next middleware. Upload will finish and call resize, resize will finish (if there is no file to resize, we eill just skip this and go to createStore) and call createStore.
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  //Set it up so that createStore will actually have the info when it creates the store. Pass it along to the next one.
  req.body.photo = `${uuid.v4()}.${extension}`;
  //Resize
  //jimp is a package that is based on promises so we can await.
  //jimp.read -> You either pass it a file location in your server or you pass it a buffer.
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  //Write it to the actual folder
  await photo.write(`./public/uploads/${req.body.photo}`);
  //Once we have written the photo to our file system, keep going.
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id; //Take the _id of the current logged in user and put it in the author field.
  const store = await(new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  //1. Query the database for a list of all stores
  //Our controller is responsible for 2 things: Get the data from the db and then pass it to the template which will render it out
  const page = req.params.page || 1;//If we are in the home page.
  const limit = 4;
  const skip = (page * limit) - limit

  //Rather than awaiting our store data, we are going to be doing 2 queries (look for stores and count) and use Promise.all to await them both.

  const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({
      created: 'desc'
    });

  const countPromise = Store.count();

  //Fire both queries at the same time, but we will wait for both of them to come back.
  const [stores, count] = await Promise.all([ storesPromise, countPromise ]);
  const pages = Math.ceil(count / limit);

  if(!stores.length && skip) {
    req.flash('info', `Hey! You asked for page ${page}. But that doesn't exist. So i Put you on page ${pages}`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

exports.getStoreBySlug = async (req, res, next) => {
  //If it doesn't find a store, it will return null.
  const store = await (await Store.findOne({ slug: req.params.slug })).populate('author reviews'); //populate will work kinf of like an .Include in entity framework. It will include bring the user data (from User document) into our store.
  if(!store) {
    //This will assume that this is a middleware and pass it to the next step (if we take a look at app.js will be app.use(errorHandlers.notFound);)
    return next();
  }
  res.render('store', { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  //We can create our own static methods that live on our Store model and we can name them however we want.
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };

  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  //Await for both promises to come back. E.g. If one promise takes 1 second to complete and the other 0.5 seconds, we are going to wait 1 second because thats the slowest one.
  //The way we can await for multiple promises to come back is with something called Promise.all. You pass it an array of promises.
  //We can destructure the result into variables:
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  
  res.render('tags', { tags, title: 'Tags', tag, stores });
}

const confirmOwner = (store, user) => {
  //Equals is a method that comes along, why? because store.author is an ObjectId, and in irder to compare an ObjectId to an actual string, we need to use the .equals method. 
  if(!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it!');
  }
};

exports.editStore = async (req, res) => {
  //1. Find the store given the id
  //Every query to mongodb returns a promise. In order for us to put the actual store data in the const, we need to await that promise to be resolved.
  const store = await Store.findOne({ _id: req.params.id });
  //2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  //3. Render out the edit form so the user can update their store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  //Before we send the req.body, set the location data to be a point. If we do not have this type point, it will not now how to look for stores that are close to us.
  req.body.location.type = 'Point';

  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, //return the new store (updated) instead of the old one
    runValidators: true //run the schema validations we added (like required fields)
  }).exec();
  //2. Redirect to the store and tell them it worked
  req.flash('success', `Successfully updated ${store.name} <strong><a href="/store/${store.slug}">View Store</a></strong>`);
  res.redirect(`/stores/${store._id}/edit`);
};

/*
  API
*/
exports.searchStores = async (req, res) => {
  //api/search?q=coffee
  //The way to access q would be by -> req.query.q
  const stores = await Store
    //First find stores that match
    .find({
      //Since we have indexed name and description as a compound index, we can use the $text operator.
      //$text operator performs a text search on the content of the fields indexed with a text index.
      $text: {
        $search: req.query.q
        //There are other operators that we can use here like:
        //$language -> Determines what language it is.
        //$caseSensitive -> By default is case insensitve.
        //$diacriticSensitive -> Ignore accents. If somebody searches for té it will just treat it as a regular e.
      }
    }, {
      //This will add a field called "score". Text score is the only metadata thats available right now in MongoDB. This will be useful to us, because we can sort the results that have the more hits in their name and or description.
      score: { $meta: 'textScore' }
    })
    //Sort them
    .sort({
      score: { $meta: 'textScore' }
    })
    //Limit to only 5 results
    .limit(5);
  
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  //MongoDB expects us to pass the longitude and latitude (long goes first for MongoDB) as an array of numbers.
  //.map(parseFloat) will map into every item in the array and turn it into an actual number.
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  //Query for Store.find
  const q = {
    location: {
      //$near is an operator inside MongoDB that will allow us to just search for stores that are near a certain latitude and longitude.
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 //1000 mts
      }
    }
  };
  //.select -> Speciify either which fields you do want, or which fields you do not want.
  //for fields that you want -> .select('slug name description location');
  //for fields that you don't want to be returned -> select('-author -tags');
  const stores = await Store.find(q)
                          .select('slug name description location photo')
                          .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  //List of user hearts. If they already have the store hearted, by posting to this url we are going to remove it. If they don't have it then posting to this url will add it.
  //You would think that we already have an array of ids, but its really an array of objects, thats why we have to map and convert to id of strings.
  //.toString() will work because MongoDB has overwritten the .toString method on each of the objects which will allow us to get a list of possible strings.
  const hearts = req.user.hearts.map(obj => obj.toString());
  //Operators in which we can take it out or insert into, will be a variable.
  //$pull -> MongoDB operator to remove from the hearts array on our User.
  //$addToSet -> The reason why this is not push (or the equivalent in MongoDB that is ) is because we want it to be unique. There is an equivalent to push in MongoDB which will just add it multiple times but by saying $addToSet it will make sure that we don't add one element twice to a specific user.
  const operator = hearts.includes(req.params.id)? '$pull': '$addToSet';
  const user = await User.findByIdAndUpdate(req.user._id, 
    //computing propery names in ES6 which is []. This will replace itself with with either $pull or $addToSet.
    { [operator]: { hearts: req.params.id } },
    //This is going to return to us the updated user.
    { new: true }
  );
  res.json(user)
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    //This will find any stores where their id is in an array. It will lok in the array for us and find all the stores that we have.
    _id: { $in: req.user.hearts }
  });

  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: 'Top Stores!' });
};