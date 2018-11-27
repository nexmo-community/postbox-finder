const Nexmo = require('nexmo')

const nexmo = new Nexmo({
  apiKey: '7c47a82b',
  apiSecret: 'Mg5AHLqxhSBH77s1',
  applicationId: 'a5c4e5af-3d84-40ed-8366-b082beeeeefd',
  privateKey: 'private.key'
})

nexmo.channel.send(
  { "type": "sms", "number": "447418340098" },
  { "type": "sms", "number": "MeDammit" },
  {
    "content": {
      "type": "text",
      "text": "This is an SMS sent from the Messages API"
    }
  },
  (err, data) => { console.log(data.message_uuid); }
);