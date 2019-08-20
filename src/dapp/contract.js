import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import Flights from "../../flight";
import TruffleContract  from "truffle-contract";


export default class Contract {


    constructor(network, callback) {

        this.config = Config[network];
        // default
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.config.url));
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = [...Flights];
        this.oracles = [];
        this.statuses = {
            0: "Unknown",
            10: "On Time",
            20: "Late (Airline)",
            30: "Late (Weather)",
            40: "Late (Technical)",
            50: "Late (Other)"
        };


        if (window.ethereum) {
            console.log("found window.ethereum");
            const ethereum = window.ethereum;
            this.web3 = new Web3(ethereum);
            ethereum.enable().then((account) => {
                let defaultAccount = account[0];
                this.web3.eth.defaultAccount = defaultAccount;
                this.owner = defaultAccount;
                this.flightSuretyApp = TruffleContract(FlightSuretyApp, this.config.appAddress);
                this.flightSuretyApp.setProvider(this.web3.currentProvider);
                this.flightSuretyApp.defaults({from: this.web3.eth.defaultAccount});
                console.log("enabled");
                console.log(`e owner: ${this.owner}`);
                // FIXME:
                // this.web3.currentProvider.publicConfigStore.on("update", this.resetAccounts);
                callback();
            });
        }
    }

    resetAccounts() {
        window.ethereum.enable().then((account) => {
            let defaultAccount = account[0];
            this.web3.eth.defaultAccount = defaultAccount;
            this.owner = defaultAccount;
            console.log(`reset to: ${this.owner}`);
        });
    }

    async registerEvents(callback) {
        let self = this;
        return self.flightSuretyApp.deployed().then((app) => {
            console.log(app);
            app.allEvents({}, (error, event) => {
                console.log(error);
                console.log(event);
                callback({topic: "topic", title: "title", error: error, value: "blah"});
            });

        }).then(() => { console.log("registered"); });
    }

    async isOperational(callback) {
        let self = this;
        self.flightSuretyApp.deployed().then((app) => {
            return app.isOperational.call({from: self.owner}).then(callback);
        // await self.flightSuretyApp.isOperational()
            //     .call({ from: self.owner}, callback);
        });
    }

    async fetchFlightStatus(flight, callback) {
        let name = flight.trim();
        let self = this;
        let payload = {
            airline: null,
            flight: flight,
            timestamp: 0
        };

        let found = false;
        for (let f of this.flights) {
            if (f.name === name) {
                payload.airline = f.address;
                payload.timestamp = f.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            callback(`unknown flight: ${flight}`, payload);
            return;
        }

        let accts = await window.ethereum.enable();
        console.log(accts[0]);

        self.flightSuretyApp.deployed().then((app) => {
            return app.fetchFlightStatus(payload.airline, payload.flight, payload.timestamp, {from: accts[0], gas: self.config.gas})
                .then(() => {
                    return app.getFlightStatus.call(payload.airline, payload.flight, payload.timestamp, {from: accts[0], gas: self.config.gas});
                })
                .then((result) => { console.log(this.statuses[result.toNumber()]);
                                    callback(null, `${flight} status: ${this.statuses[result.toNumber()]}`); })
                .catch((error) => { console.log(error); callback(error, null); });
        });
    }

    async buyInsurance(flight, insurance, callback) {
        let name = flight.trim();
        let self = this;
        let payload = {
            airline: null,
            flight: flight,
            timestamp: 0
        };

        let found = false;
        for (let f of this.flights) {
            if (f.name === name) {
                payload.airline = f.address;
                payload.timestamp = f.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            callback(`unknown flight: ${flight}`, payload);
            return;
        }

        let accts = await window.ethereum.enable();
        console.log(accts[0]);

        let value = 1;

        try {
            value = this.web3.utils.toWei(insurance.toString(), "ether");
        }
        catch (e) {
            console.log(e);
            return callback(e, null);
        }

        self.flightSuretyApp.deployed().then((app) => {
            return app.buyInsurance(payload.airline, payload.flight, payload.timestamp, {from: accts[0], value: value, gas: self.config.gas})
                .then(() => {
                    return app.insuredAmount.call(payload.airline, payload.flight, payload.timestamp, {from: accts[0]});
                })
                .then((result) => {
                    console.log(result.toString());
                    return callback(null, `bought ${result.toString()} wei of insurance on ${flight}`);
                })
                .catch((error) => { console.log(error); callback(error, null); });
        });
    }

    async insuredAmount(flight, callback) {
        let name = flight.trim();
        let self = this;
        let payload = {
            airline: null,
            flight: flight,
            timestamp: 0
        };

        let found = false;
        for (let f of this.flights) {
            if (f.name === name) {
                payload.airline = f.address;
                payload.timestamp = f.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            callback(`unknown flight: ${flight}`, payload);
            return;
        }

        let accts = await window.ethereum.enable();
        console.log(accts[0]);

        self.flightSuretyApp.deployed().then((app) => {
            return app.insuredAmount.call(payload.airline, payload.flight, payload.timestamp, {from: accts[0]})
                .then((result) => {
                    console.log(result.toString());
                    return callback(null, `${result.toString()} wei of insurance on ${flight}`);
                })
                .catch((error) => { console.log(error); callback(error, null); });
        });
    }


    async payPassenger(callback) {
        let self = this;
        let accts = await window.ethereum.enable();

        console.log(accts[0]);

        self.flightSuretyApp.deployed().then((app) => {
            return app.payPassenger({from: accts[0], gas: this.config.gas})
                .then(async (result) => {
                    console.log(result.toString());
                    return callback(null, `check your account balance`);
                })
                .catch((error) => { console.log(error); callback(error, null); });
        });
    }


    fetchFlights() {
        return this.flights;
    }
}
