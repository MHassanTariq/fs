import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import Flights from "../../flight";
import TruffleContract  from "truffle-contract";


export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        // default
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = [...Flights];
        this.oracles = [];

        if (window.ethereum) {
            console.log("found window.ethereum");
            const ethereum = window.ethereum;
            this.web3 = new Web3(ethereum);
            ethereum.enable().then((account) => {
                let defaultAccount = account[0];
                this.web3.eth.defaultAccount = defaultAccount;
                this.owner = account[0];
                this.flightSuretyApp = TruffleContract(FlightSuretyApp, config.appAddress);
                this.flightSuretyApp.setProvider(this.web3.currentProvider);
                this.flightSuretyApp.defaults({from: this.web3.eth.defaultAccount});
                console.log("enabled");
                console.log(`e owner: ${this.owner}`);
                // FIXME: this.web3.currentProvider.publicConfigStore.on("update", this.initialize);
                callback();
            });
        }
    }

    async isOperational(callback) {
        let self = this;
        self.flightSuretyApp.deployed().then((app) => {
            return app.isOperational({from: self.owner}).then(callback);
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

        let accts = window.ethereum.enable();
        console.log(accts[0]);

        await self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: accts[0]}, (error, result) => {
                callback(error, payload);
            });
    }

    fetchFlights() {
        return this.flights;
    }
}
