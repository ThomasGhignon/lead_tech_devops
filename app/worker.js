const {PubSub} = require('@google-cloud/pubsub');
const ZipStream = require('zip-stream');
const { Storage } = require('@google-cloud/storage');
const request = require('request');
const photoModel = require('./photo_model');

// Creates a client; cache this for further use
const pubSubClient = new PubSub();

function listenForMessages(subscriptionNameOrId, timeout) {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionNameOrId);

  // Create an event handler to handle messages
  let messageCount = 0;
  const messageHandler = message => {
    console.log(`Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);
    console.log(`\tAttributes: ${message.attributes}`);
    messageCount += 1;

    photoModel.getFlickrPhotos(message.data, "all")
      .then(photos => {
        let result = []
        for (const [key, value] of Object.entries(photos)) {
          result.push({
            name: value.title,
            url: value.media.m
          })
        }
        zip(result)
      })

    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  // Wait a while for the subscription to run. (Part of the sample only.)
  setTimeout(() => {
    subscription.removeListener('message', messageHandler);
    console.log(`${messageCount} message(s) received.`);
  }, timeout * 1000);
}
// [END pubsub_subscriber_async_pull]
// [END pubsub_quickstart_subscriber]

function main(
  subscriptionNameOrId = 'dmii2-2',
  timeout = 60
) {
  timeout = Number(timeout);
  listenForMessages(subscriptionNameOrId, timeout);
}

main(...process.argv.slice(2));


async function zip(queue) {
  let zip = new ZipStream();
  let storage = new Storage();
  const file = await storage
    .bucket("dmii2023bucket")
    .file('public/users/melpic');
  const stream = file.createWriteStream({
    metadata: {
      contentType: "application/zip",
      cacheControl: 'private'
    },
    resumable: false
  });

  zip.pipe(stream)

  function addNextFile() {
    var elem = queue.shift();
    var streami = request(elem.url);
    zip.entry(streami , { name: elem.name + '.jpg' }, err => {
      if (err)
        throw err;
      if (queue.length > 0) {
        addNextFile();
      }
      else {
        zip.finalize();
      }
    });
  }

  addNextFile();

  await new Promise ((resolve, reject) => {
    stream.on('error', (err) => {
      reject(err);
    });
    stream.on('finish', () => {
      resolve('Ok');
    });
  });
}