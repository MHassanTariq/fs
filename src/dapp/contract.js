import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import Flights from "../../flight";

export default class Contract {
    constructor(network, callback) {
        let config = Config[network];

        if (typeof window.ethereum !== "undefined") {
            console.warn("Using web3 detected from external source like Metamask");
            this.web3 = new Web3(web3.currentProvider);
        } else {
            this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        }
        // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = [];
        this.oracles = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts(async (error, accts) => {

            this.owner = accts[0];

            this.airlines = accts.slice(1,5);
            this.flights = [...Flights];
            this.oracles = accts.slice(29,49);

            callback();
        });
    }

    async isOperational(callback) {
        let self = this;
        await self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    async fetchFlightStatus(flight, callback) {
        let name = flight.trim();
        let self = this;
        let payload = {
            airline: null,
            flight: flight,
            timestamp: 0
        }

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
