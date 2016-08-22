# microgear-reactnative

microgear-reactnative is a client library for React Native. The library is used to connect application code or hardware with the NETPIE Platform's service for developing IoT applications. For more details on the NETPIE Platform, please visit https://netpie.io .

## Outgoing Network Port

Make sure ther following ports are allowed to connect from your network.
- TLS mode : 8081 and 8883 (microgear-reactnative alway uses this mode)

## Installation

```
npm install microgear-reactnative
```

## Usage example
```js
import Micrograr from 'microgear-reactnative';

const APPID = <APPID>;
const KEY = <APPKEY>;
const SECRET = <APPSECRET>;

const microgear = MicroGear.create({
    key : KEY,
    secret : SECRET
});

microgear.on('connected', () => {
    console.log('Connected...');
    microgear.setAlias("mygear");
    setInterval(() => {
        microgear.chat('mygear', 'Hello world.');
    }, 1000);
});

microgear.on('message', (topic,body) => {
    console.log('incoming : '+topic+' : '+body);
});

microgear.on('closed', () => {
    console.log('Closed...');
});

microgear.connect(APPID);
```

## Library Usage

**Constructor (*gearkey*, *gearsecret*, *alias*)**

**arguments**
* *config* is a json object with the following attributes:
  * *gearkey* `string` - is used as a microgear identity.
  * *gearsecret* `string` comes in a pair with gearkey. The secret is used for authentication and integrity.
  * *alias* `string` - specifies the device alias.

```js
const microgear = new Microgear({
    key : "sXfqDcXHzbFXiLk",
    secret : "DNonzg2ivwS8ceksykGntrfQjxbL98",
    alias : "myplant"
});
```
---
## microgear
**void microgear.connect (*appid*, *callback*)**

**arguments**
* *appid* `string` - a group of application that microgear will connect to.
```js
microgear.connect("happyfarm");
```
---
**void microgear.setAlias (*gearalias*)**
microgear can set its own alias, which to be used for others make a function call chat(). The alias will appear on the key management portal of netpie.io .

**arguments**
* *alias* `string` - name of this microgear.

```js
microgear.setAlias("plant");
```
---
**void microgear.chat (*gearname*, *message*)**

**arguments**
* *gearname* `string` - name of microgear to which to send a message.
* *message* `string` - message to be sent.

```js
microgear.chat("valve","I need water");
```
---
**void microgear.publish (*topic*, *message*, [retained])**
In the case that the microgear want to send a message to an unspecified receiver, the developer can use the function publish to the desired topic, which all the microgears that subscribe such topic will receive a message.

**arguments**
* *topic* `string` - name of topic to be send a message to.
* *message* `string` - message to be sent.
* *retained* `boolean` - retain a message or not (the default is `false`)

```js
microgear.publish("/outdoor/temp","28.5");
microgear.publish("/outdoor/humid","56",true);
```
---
**void microgear.subscribe (*topic*)**
microgear may be interested in some topic.  The developer can use the function subscribe() to subscribe a message belong to such topic. If the topic used to retain a message, the microgear will receive a message everytime it subscribes that topic.

**arguments**
* *topic* `string` - name of the topic to send a message to.

```js
microgear.subscribe("/outdoor/temp");
```
---
**void microgear.unsubscribe (*topic*)**
 cancel subscription

**arguments**
* *topic* `string` - name of the topic to send a message to.

```js
microgear.unsubscribe("/outdoor/temp");
```
---

**void microgear.setCachePath (path)**
By default, a microgear token cache file is stored in the same directory as the application within a file name of this format : 'microgear-<KEY>.cache'. This function is for setting a path of microgear token cache file. It will be useful when you want to run multiple microgears of the same device key on the same location.

**arguments**
* *path* `string` - file path

```js
microgear.setCachePath('microgear-g1.cache');
```

---
**void microgear.resetToken (callback)**
send a revoke token control message to NETPIE and delete the token from cache. As a result, the microgear will need to request a new token for the next connection.

**arguments**
* *callback* `function` - this function will be called when the token reset is finished.

```js
microgear.resetToken(function(result){
});
```

Since the function resetToken() is asynchronous, to connect applicatin after token reset,  the code should be as follows.
```js
microgear.resetToken(function(result){
    microgear.connect(APPID);
});
```

---

## Events
An application that runs on a microgear is an event-driven type, which responses to various events with the callback function in a form of event function call:

**void microgear.on (*event*, *callback*)**

**arguments**
* *event* `string` - name of an event
* *callback* `function` - callback function

NETPIE consists of the following events:

**Event: 'connected'**
This event is created when the microgear library successfully connects to the NETPIE platform.
```
microgear.on("connected", function() {
	console.log("connected");
});
```

**Event: 'closed'**
This event is created when the microgear library disconnects the NETPIE platform.
```
microgear.on("closed", function() {
	console.log("closed");
});
```

**Event: 'error'**
This event is created when an error occurs within a microgear.
```
microgear.on("error", function(err) {
	console.log("Error: "+err);
});
```

**Event: 'warning'**
This event is created when some event occurs, and a warning message will be notified.
```
microgear.on("warning", function(msg) {
	console.log("Connection rejected: "+msg);
});
```

**Event: 'info'**
This event is created when there is some event occurs within a microgear
```
microgear.on("info", function(msg) {
	console.log("Connection rejected: "+msg);
});
```

**Event: 'message'**
When there is an incomming message, this event is created with the related information to be sent via the callback function.

```
microgear.on("message", function(topic,msg) {
	console.log("Incoming message: "+mesage);
});
```

**Event: 'present'**
This event is created when there is a microgear under the same appid appears online to connect to NETPIE.
```
microgear.on("present", function(event) {
	console.log("New friend found: "+event.gearkey);
});
```

**Event: 'absent'**
This event is created when the microgear under the same appid appears offline.
```
microgear.on("absent", function(event) {
	console.log("Friend lost: "+event.gearkey);
});
```
