"use strict";

const random = require("random");

const FlightSuretyApp = require("../../build/contracts/FlightSuretyApp.json");
const Config = require("./config.json");
const Web3 = require("web3");

const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));


async function doit() {
    let accounts = await web3.eth.getAccounts();
    let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

    for (let i = 1; i <= 4; i++) {
        let ts = parseInt(new Date().getTime() / 1000, 10);
        let account = accounts[random.int(0, accounts.length)];
        let result = await flightSuretyApp.methods.fetchFlightStatus(accounts[i],
                                                                     `barf ${i}`,
                                                                     ts).send({from: account, gas: config.gas});
        console.log(result.events.OracleRequest.returnValues);
    }
}

doit().then(process.exit);

// eof
