# FlightSurety

FlightSurety is a project for Udacity's Blockchain course.

The software is built with

* node 10.16.0
* npm 6.9.2
* truffle 5.0.32
* solidity 0.5.11
* web3 1.2.1

The design is covered in another [document](design.md).

## Install

This repository contains Smart Contract code in Solidity (using
Truffle), tests (also using Truffle), dApp scaffolding (using HTML,
CSS and JS) and server app scaffolding.

To install, download or clone the repo, then:

    npm install
    truffle compile

## Develop Client

To run truffle tests:

    ganache-cli -m 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' \
        -a 50 -e 100 --noVMErrorsOnRPCResponse
    for t in test/*.js; do echo $t; truffle test $t; done

To use the dapp:

    ganache-cli -m 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' \
        -a 50 -e 100 --noVMErrorsOnRPCResponse
    truffle migrate --reset
    npm run server
    npm run dapp

To view dapp:

    http://localhost:8000

## Develop Server

    ganache-cli -m 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' \
        -a 50 -e 100 --noVMErrorsOnRPCResponse
    truffle migrate --reset
    npm run server
    # register accounts, oracles
    for thing in airlines flights oracles; do
      curl -s -d '' http://localhost:3000/api/$thing | jq
    done
    # trigger a fetchFlightStatus call
    node src/server/trigger.js

## Tests

Aside from the project-provided test cases in `flightSurety.js` and
`oracle.js`, these additional tests are implemented:

### flightSurety.js

* first airline is registered but not funded
* airline is not funded if it sends less than 10 ether
* airline cannot register an Airline using `registerAirline()` if it is not funded
* airline is funded if it sends 10 or more more ether
* airline can register another Airline using `registerAirline()` if it is funded

### flights.js

* a non-funded airline address cannot register a flight

### insurance.js

* (first airline) is funded
* (airline) can registers three airlines using `registerAirline()`
* register flights
* buy insurance for a flight: send no money
* buy insurance for a flight 1: send 0.5 ether
* buy insurance for a flight 2: send 2 ether but only 1 ether is insured **see note below**
* cannot buy insurance for the same flight twice
* register twenty oracles
* request flight status for flight 2 and oracles reply with 20
* passenger gets a refund of 1.5x what they put in **see note below**
* confirm that flight 1 is still insured for

**NOTE** While I have checked manually using `web3.eth.getBalance`
that the contract returns the right amount in the above two cases, I
haven't figured out how to write tests for them while also accounting
for the gas spent in calling the contract functions.

### multi.js

* (first airline) is registered but not funded
* (first airline) cannot register an Airline using `registerAirline()` if it is not funded
* airline is funded if it sends 10 or more ether
* (airline) can register another Airline using `registerAirline()` if it is funded
* (second airline) is registered but not funded at registration
* (second airline) can register third and fourth if funded
* fund third and fourth airlines to switch to multiparty
* airlines five and six can register themselves in multiparty mode with zero votes
* airline registered in multiparty mode by itself does not list itself as a voter
* airline registered in multiparty mode by itself does not increment vote count
* airline registered in multiparty mode by funded airline has one vote
* airline registered in multiparty mode by funded airline lists funded airline as voter
* (internal) check if the state of the data contract is what it should be
* can register an airline using the multiparty system

## Deploy

To build dapp for prod:

    npm run dapp:prod

Deploy the contents of the ./dapp folder
