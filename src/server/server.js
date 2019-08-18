"use strict";

import random from "random";

import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";
import Flights from "../../flights.json";

const config = Config["localhost"];

// this line is probably wrong
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace("http", "ws")));

const fsapp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const numOracles = 20;
const oracleAddressStart = 29;                                   // addresses 29 to 49 are oracles
const flightRegisterPayment = web3.utils.toWei("10", "ether");
const oracleRegisterPayment = web3.utils.toWei("1", "ether");

const CODES = {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50
};


// internal: return a random flight status code
function _randomCode()
{
    let statuses = Object.keys(CODES);
    let status = statuses[random.int(0, statuses.length-1)];

    return CODES[status];
}

// internal: listen for OracleReport and FlightStatusInfo events
function _listenmisc()
{
    fsapp.events.OracleReport({fromBlock: 0}, (err, event) => {
        if (err) { console.log(err); }
        let result = event.returnValues;

        console.log(`OracleReport ${result.airline} ${result.flight} ${result.timestamp} ${result.status}`);
    });

    fsapp.events.FlightStatusInfo({fromBlock: 0}, (err, event) => {
        if (err) { console.log(err); }
        let result = event.returnValues;

        console.log(`FlightStatusInfo ${result.airline} ${result.flight} ${result.timestamp} ${result.status}`);
    });
}


// setup initial 4 airlines, only for testing
async function setupAirlines(req, res)
{
    const accounts = await web3.eth.getAccounts();
    let did = [];

    // fund first airline if not funded
    let r = await fsapp.methods.isFunded(accounts[1]).call({from: accounts[0], gas: config.gas});
    if (!r[0]) {
        await fsapp.methods.fundAirline().send({from: accounts[1], value: flightRegisterPayment, gas: config.gas});
        did.push("funded first airline");
    } else {
        did.push("first airline already funded");
    }

    for (let i = 2; i <= 4; i++) {
        let name = `Air ${i}`;

        r = await fsapp.methods.isRegistered(accounts[i]).call({from: accounts[0], gas: config.gas});
        if (!r[0]) {
            console.log(`registering airline ${i} address ${accounts[i]} name ${name}`);
            await fsapp.methods.registerAirline(accounts[i], name).send({from: accounts[1], gas: config.gas});
            did.push(`registered airline ${i} address ${accounts[i]} name ${name}`);
        } else {
            did.push(`already registered: airline ${i} address ${accounts[i]} name ${name}`);
        }
        r = await fsapp.methods.isFunded(accounts[i]).call({from: accounts[0], gas: config.gas});
        if (!r[0]) {
            console.log(`funding airline ${i} address ${accounts[i]} name ${name}`);
            await fsapp.methods.fundAirline().send({from: accounts[i], value: flightRegisterPayment, gas: config.gas});
            did.push(`funded airline ${i} address ${accounts[i]} name ${name}`);
        } else {
            did.push(`already funded: airline ${i} address ${accounts[i]} name ${name}`);
        }
    }

    return res.json({status: "okay", "events": did}).end();
}


async function setupFlights(req, res)
{
    const accounts = await web3.eth.getAccounts();
    let did = [];

    // each airline gets two flights
    for (let i = 0; i <= Flights.length-1; i++) {
        let address = accounts[1+Math.floor(i/2)];
        let flight = Flights[i];
        console.log(`airline ${address} flight: ${flight.name}`);
        did.push(`airline ${address} flight: ${flight.name}`);
    }
    return res.json({status: "okay", "events": did}).end();
}

// setup oracles and have them listen for events
async function setupOracles(req, res)
{
    const accounts = await web3.eth.getAccounts();
    const oracles = accounts.slice(oracleAddressStart, oracleAddressStart+numOracles+1);
    let idxmap = {};
    let did = [];

    for (let i = 0; i < numOracles; i++) {
        let account = oracles[i];

        let result = await fsapp.methods.registerOracle().send({from: account, value: oracleRegisterPayment, gas: config.gas});
        console.log(`oracle ${i} account ${account}: ${result.status}`);
        did.push(`oracle ${i} account ${account}: ${result.status}`);

        let indexes = await fsapp.methods.getMyIndexes().call({from: account});
        idxmap[account] = [...indexes];

        // listen
        fsapp.events.OracleRequest({fromBlock: 0, filter: {index: [...indexes]}}, (err, event) => {
            if (err) { console.log(err); }
            let result = event.returnValues;

            console.log(`${i} OracleRequest: airline ${result.airline}, flight: ${result.flight}, time: ${result.timestamp}, index: ${result.index}`);
            let code = _randomCode();
            console.log(`${i} (${oracles[i]} - ${idxmap[oracles[i]]}: replying with ${code}`);
            fsapp.methods.submitOracleResponse(result.index, result.airline, result.flight, result.timestamp, code).send({from: oracles[i], gas: config.gas});
        });
    }

    return res.json({status: "okay", "events": did}).end();
}

// start non-oracle listeners
_listenmisc();

const app = express();

app.get("/api", (req, res) => {
    res.send({message: "An API for use with your Dapp!"});
});

app.post("/airlines", setupAirlines);
app.post("/flights", setupFlights);
app.post("/oracles", setupOracles);

export default app;

// eof
