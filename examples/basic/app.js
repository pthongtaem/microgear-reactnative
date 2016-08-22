#!/usr/bin/env node

var MicroGear = require('../../lib/');

const KEY    = 'M8YDQobAP8C3PfI';
const SECRET = '2iOTp235lq0bR7NuetKztQFCs';
const APPID     = 'dontest';

var microgear = new MicroGear.default({
    key : KEY,
    secret : SECRET
});

microgear.on('connected', function() {
    console.log('Connected...');
    microgear.setalias("mygear");
    setInterval(function() {
        microgear.chat('mygear', 'Hello world.');
    },1000);
});

microgear.on('message', function(topic,body) {
    console.log('incoming : '+topic+' : '+body);
});

microgear.on('closed', function() {
    console.log('Closed...');
});

microgear.connect(APPID);
