# FlightSurety Project Design

This document lists the design decisions made in implementing the
project.

# Authorizing The App Contract

`migrations/2_deploy_contracts.js` authorizes the app contract right
after deploying both contracts.

# Accounts: Airlines, Oracles, Passengers

The development blockchain is set up to create 50 accounts, using `ganache-cli`.

* Account #0 is the contract owner.
* Accounts #1 through #4 are airlines.
* Account #10 is used as the passenger in tests.
* Accounts #29 to #49 are oracles.

# Flights

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

# Registering Airlines

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

# Funding Airlines

A registered airline can call `fundAirline` in the app contract any
number of times.  When the amount sent by the airline equals or
exceeds 10 ether, the airline is funded.  The airline isn't prevented
from sending more funds than 10 ether.

# Registering Flights

A funded airline can register a flight by passing the flight name and
timestamp to the app contract's `registerFlight` function.

# Purchasing insurance

A passenger can purchase insurance for any number of valid flights,
though they can pay for only a flight once.  The app contract is
responsible for checking how much ether the passenger has sent along
with the `buyInsurance` call, and for refunding any amount greater
than 1 ether.
