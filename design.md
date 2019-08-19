# FlightSurety Project Design

This document lists the design decisions made in implementing the
project.

## Authorizing The App Contract

`migrations/2_deploy_contracts.js` authorizes the app contract right
after deploying both contracts.

## Accounts: Airlines, Oracles, Passengers

The development blockchain is set up to create 50 accounts, using `ganache-cli`.

* Account #0 is the contract owner.
* Accounts #1 through #4 are airlines.
* Account #10 is used as the passenger in tests.
* Accounts #29 to #49 are oracles.

## Flights

There are eight flights in `flights.json`/`flights.js` (they have the
same contents).  Each flight dictionary looks like

    {"name": "flight name",
     "isRegistered: true,
     "statusCode" 0,
     "timestamp": ...,
     "address": airline address,
     "from": "airport",
     "to": "airport"
    }

The first two flights are assigned to the first airline, the second
two to the second airline, and so on.  This arrangement is used in the
server code to register flights against airlines, and in the dapp to
list airlines that the passenger can purchase insurance for.

## Registering Airlines

The code makes a distinction between airlines added to the account,
registered airlines, and funded airlines.

The first airline is registered at contract creation time, but not
funded.  After funding the airline, it can go on to register
additional airlines using the data contract's `registerAirline`
function, up to four.  (Any funded airline, up to the limit of four,
can register another airline.)

After four airlines are registered, the contract switches to
multiparty registration mode.  In this case, a funded airline can add
a new airline to the contract **OR** a new (unregistered, unfunded)
airline can add itself by calling `registerAirline`.

Airlines are not considered *registered* until at least 50% of the
funded airlines have voted for it.  Funded airlines vote by calling
the `registerAirline` function in the data contract.

## Funding Airlines

A registered airline can call `fundAirline` in the app contract any
number of times.  When the amount sent by the airline equals or
exceeds 10 ether, the airline is funded.  The airline isn't prevented
from sending more funds than 10 ether.

## Registering Flights

A funded airline can register a flight by passing the flight name and
timestamp to the app contract's `registerFlight` function.

## Purchasing Insurance

A passenger can purchase insurance for any number of valid flights,
though they can pay for a flight only once.  The app contract is
responsible for checking how much ether the passenger has sent along
with the `buyInsurance` call, and for refunding any amount greater
than 1 ether.

## Oracle Responses

If three or more oracles reply to an `OracleRequest` event with the
same flight status code, the flight's `statusCode` is updated in the
data contract.

## Paying out

If three oracles report that a flight is delayed due to the airline
(`STATUS_CODE_LATE_AIRLINE`), the data contract begins the process of
crediting the passengers.  For every passenger that paid for insurance
for that flight, the contract calculates 1.5 times the amount they've
paid and stores that in a `payouts` mapping.  The amount in `payouts`
accumulates until it is withdrawn.

Passengers can call the `payPassenger` function in the app contract at
any time to get their eth.  It is not an error to call `payPassenger`
if there is nothing to pay out.

## Events

These events are emitted from the app contract:

* OracleRequest: emitted when the contract wants oracles to check a flight's status
* OracleReport: emitted when an oracle submits a response
* FlightStatusInfo: emitted when enough oracles have submitted the same status

These events are emitted from the data contract:

* AirlineRegistered: an airline has been registered
* AirlineSentFunds: an airline has sent funds to the contract
* AirlineFunded: an airline has paid enough ether to be funded
* FlightRegistered: an airline has registered a flight
* InsuranceBought: a passenger has bought insurance
* PayableInsurance: a passenger has an insurance payout waiting
