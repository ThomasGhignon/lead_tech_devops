const formValidator = require('./form_validator');
const photoModel = require('./photo_model');
const { PubSub } = require('@google-cloud/pubsub');
const request = require('request');
const ZipStream = require('zip-stream');
const { Storage } = require('@google-cloud/storage');
const moment = require('moment');

let currentTags;
let currentMod;

function route(app) {
  app.get('/', async (req, res) => {
    const tags = req.query.tags;
    const tagmode = req.query.tagmode;
    const options = {
      action: 'read',
      expires: moment().add(2, 'days').unix() * 1000
    };
    let storage = new Storage();
    const signedUrls = await storage
      .bucket("dmii2023bucket")
      .file('public/users/melpic')
      .getSignedUrl(options);

    console.log(signedUrls);

    currentTags = tags;
    currentMod = tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      download: signedUrls.length ? signedUrls : "",
      searchResults: false,
      invalidParameters: false
    };

    // if no input params are passed in then render the view with out querying the api
    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    // validate query parameters
    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }

    // get photos from flickr public feed api
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
        return res.status(500).send({ error });
      });
  });
  app.post('/zip', async (req, res) => {
    const tags = currentTags
    const tagmode = currentMod
    let topic = await quickstart()

    await topic.publishMessage({ data: Buffer.from(tags) });

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      invalidParameters: false
    };

    // if no input params are passed in then render the view with out querying the api
    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    // validate query parameters
    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }

    return res.render('index', ejsLocalVariables);
  });
}

async function quickstart(
  projectId = 'temporaryprojectdmii', // Your Google Cloud Platform project ID
  topicNameOrId = 'dmii2-2', // Name for the new topic to create
  subscriptionName = 'dmii2-2' // Name for the new subscription to create
) {
  // Instantiates a client
  const pubsub = new PubSub({projectId});

  // Creates a new topic
  const topic = await pubsub.topic(topicNameOrId);
  console.log(`Topic ${topic.name} created.`);

  // Creates a subscription on that new topic
  await topic.subscription(subscriptionName);

  return topic
}

module.exports = route;
