pragma solidity ^0.5.11;

import "node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    struct Airline {
        address airline;
        string name;
        bool isRegistered;
        bool isFunded;
        uint256 amountFunded;
    }

    struct Flight {
        string name;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    mapping(bytes32 => Flight) private flights;     // flight key (airline, flight, timestamp) to flight details

    // contract
    address private contractOwner;                  // Account used to deploy contract
    bool private operational = true;                // Blocks all state changes throughout the contract if false
    mapping(address => bool) private appContracts;  // Only authorized app contracts can call this contract.

    // airlines
    mapping(address => Airline) private airlines;   // registered airlines
    mapping(address => uint256) private votes;      // airlines in the queue and their votes
    mapping(address => address[]) private voters;   // list of voters for an airline
    uint256 public numAirlines;                     // number of airlines, registered or unregistered
    uint256 private numRegisteredAirlines;           // number of registered airlines
    uint256 private numFundedAirlines;               // number of funded airlines

    // funds, should match web3.eth.getBalance(data contract's account);
    uint256 private totalFunds;                     // total funds available

    // passenger insurance
    mapping(bytes32 => uint256) private insurance;     // map hash(passenger, flightkey) -> amount paid in
    mapping(address => uint256) private payouts;       // map passenger -> amount to be paid out
    mapping(bytes32 => address[]) private passengers;  // map flight key -> passengers

    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    event AirlineSentFunds(address airline, uint256 amount, uint256 totalsent);
    event AirlineRegistered(address airline, string name);
    event AirlineFunded(address airline, string name);

    event FlightRegistered(address airline, string name, uint256 timestamp, bytes32 key);
    event InsuranceBought(address passenger, string name, bytes32 key, uint amount);
    event PayableInsurance(address passenger, string name, uint amount);

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address address_, string memory name_) public
    {
        contractOwner = msg.sender;
        Airline memory first = newAirline(address_, name_);
        first.isRegistered = true;
        airlines[address_] = first;
        numAirlines = numAirlines.add(1);
        numRegisteredAirlines = numRegisteredAirlines.add(1);
        emit AirlineRegistered(address_, name_);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the app contract(s) to be the caller
     */
    modifier requireAppCaller()
    {
        require(appContracts[msg.sender], "Caller is not authorized");
        _;
    }

    /**
     * @dev Modifier that requires the function caller be a registered airline
     */
    modifier requireRegisteredAirline(address airline)
    {
        require(airlines[airline].isRegistered, "Caller is not a registered airline");
        _;
    }


    /**
     * @dev Modifier that requires the function caller be a registered airline that has paid up
     */
    modifier requireFundedAirline(address airline)
    {
        require(airlines[airline].isFunded, "Caller is not a funded airline");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns(bool)
    {
        return operational;
    }


    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }

    /**
     * @dev Create a new airline
     */
    function newAirline(address account, string memory name_) internal pure returns (Airline memory)
    {
        // the airline must have a name if we are registering it
        require(keccak256(abi.encodePacked(name_)) != keccak256(abi.encodePacked("")),
                "Airline must have a name");
        return Airline({airline: account, name: name_, isRegistered: false, isFunded: false, amountFunded: 0});
    }

    function hasVoted(address votingAirline, address airline) public view requireAppCaller() returns (bool)
    {
        address[] memory voted = voters[airline];

        for (uint idx = 0; idx < voted.length; idx++) {
            if (votingAirline == voted[idx]) {
                return true;
            }
        }

        return false;
    }

    function numVotes(address airline) public view requireAppCaller() returns (uint256)
    {
        return votes[airline];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address registeringAirline, address address_, string calldata name_)
        external
        requireIsOperational()
        returns (bool, uint256)
    {
        require(appContracts[msg.sender], "Caller is not authorized");

        // cannot re-register a registered airline
        require(!airlines[address_].isRegistered, "Airline is already registered");

        // with fewer than four registered airlines, an existing funded airline can add
        // the new airline
        if (numRegisteredAirlines < 4) {
            require(airlines[registeringAirline].isFunded, "Caller is not a funded airline");

            Airline memory a = newAirline(address_, name_);
            a.isRegistered = true;
            airlines[address_] = a;
            numAirlines = numAirlines.add(1);
            numRegisteredAirlines = numRegisteredAirlines.add(1);
            emit AirlineRegistered(address_, name_);
            return (true, 0);
        }

        // after 4 airlines are funded, we are in multiparty mode
        // an airline can add itself, or a funded airline can add an airline
        // however, the added airline is not considered "registered" until
        // numFundedAirlines/2 airlines have voted for it.

        if (registeringAirline != address_) {
            // an unfunded airline cannot register another airline
            require(airlines[registeringAirline].isFunded, "Caller is not a funded airline");

            // has registeringAirline voted for this airline before?
            address[] memory voted = voters[address_];
            bool found = false;
            for (uint idx = 0; idx < voted.length; idx++) {
                if (registeringAirline == voted[idx]) {
                    found = true;
                    break;
                }
            }

            require(!found, "Have already voted for this airline");
        }

        Airline memory a = airlines[address_];

        // new airline
        if (a.airline != address_) {
            a = newAirline(address_, name_);
            airlines[address_] = a;
            voters[address_] = new address[](0);
            // if the registering airline is a funded airline, add 1 vote
            if (airlines[registeringAirline].isFunded) {
                voters[address_].push(registeringAirline);
                votes[address_] = 1;
            }
            numAirlines = numAirlines.add(1);
            return (false, 1);
        }

        uint256 totalVotes = votes[address_];

        // in the queue already? increment its vote count if a funded airline called register
        // when the vote is > fundedAirlines/2, promote it to registered

        if (airlines[registeringAirline].isFunded) {
            voters[address_].push(registeringAirline);
            votes[address_] = votes[address_].add(1);
        }

        if (votes[address_] > numFundedAirlines.div(2)) {
            airlines[address_].isRegistered = true;
            numRegisteredAirlines = numRegisteredAirlines.add(1);
            delete votes[address_];
            delete voters[address_];
            emit AirlineRegistered(address_, airlines[address_].name);
            return (true, 0);
        } else {
            return (false, totalVotes+1);
        }
    }

    /**
     * @dev Is the airline known to the contract?  Returns true or false.
     */
    function isAirline(address address_) external view requireAppCaller() returns (bool)
    {
        return (airlines[address_].airline == address_);
    }

    /**
     * @dev Is the airline registered?  Returns (true or false, number of airlines)
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function isAirlineRegistered(address address_) external view requireAppCaller() returns (bool, uint256)
    {
        return (airlines[address_].isRegistered, numAirlines);
    }

    /**
     * @dev Is the airline funded?  Returns (true or false, number of funded airlines)
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function isAirlineFunded(address address_) external view requireAppCaller() returns (bool, uint256)
    {
        return (airlines[address_].isFunded, numFundedAirlines);
    }

    function registerFlight(address airline_, string calldata name_, uint256 timestamp)
        external
        requireIsOperational()
        requireAppCaller()
        requireFundedAirline(airline_)
        returns (bytes32)
    {
        bytes32 key = getFlightKey(airline_, name_, timestamp);

        if (flights[key].isRegistered && flights[key].statusCode == 0) {
            // nothing to do, already registered and has no flight data
            return key;
        }

        Flight memory f = Flight({name: name_, isRegistered: true, statusCode: 0, updatedTimestamp: timestamp, airline: airline_});
        flights[key] = f;

        // no passengers right now
        passengers[key] = new address[](0);

        emit FlightRegistered(airline_, name_, timestamp, key);

        return key;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buyInsurance(address passenger, uint amount, address airline, string calldata name, uint256 timestamp)
        external
        requireIsOperational()
        requireAppCaller()
        requireFundedAirline(airline)
        returns (bool)
    {
        bytes32 key = getFlightKey(airline, name, timestamp);
        require(flights[key].isRegistered && flights[key].statusCode == 0, "Flight cannot be insured for");

        bytes32 ikey = getFlightInsuranceKey(passenger, key);
        require(insurance[ikey] == 0, "Already bought insurance");

        insurance[ikey] = amount;
        passengers[key].push(passenger);

        emit InsuranceBought(passenger, name, key, amount);

        return true;
    }

    function insuredAmount(address passenger, address airline, string calldata name, uint256 timestamp)
        external
        view
        requireIsOperational()
        requireAppCaller()
        returns (uint)
    {
        bytes32 key = getFlightKey(airline, name, timestamp);
        bytes32 ikey = getFlightInsuranceKey(passenger, key);
        return insurance[ikey];
    }

    function processFlightStatus(address airline, string calldata flight, uint256 timestamp, uint8 statusCode)
        external
        requireIsOperational()
        requireAppCaller()
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);

        flights[key].statusCode = statusCode;
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(address airline, string calldata flight, uint256 timestamp)
            external
            requireIsOperational()
            requireAppCaller()
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(flights[key].statusCode == STATUS_CODE_LATE_AIRLINE, "Flight not late due to airline");

        address[] memory ps = passengers[key];
        for (uint idx = 0; idx < ps.length; idx++) {
            bytes32 ikey = getFlightInsuranceKey(ps[idx], key);
            if (insurance[ikey] > 0) {
                uint refund = insurance[ikey].mul(3).div(2);
                totalFunds = totalFunds.sub(refund); // this can run out
                payouts[ps[idx]] = payouts[ps[idx]].add(refund);
                insurance[ikey] = 0;
                emit PayableInsurance(ps[idx], flight, payouts[ps[idx]]);
            }
        }
        passengers[key] = new address[](0);
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address payable passenger)
        external
        requireIsOperational()
        requireAppCaller()
    {
        uint payment = payouts[passenger];
        if (payment > 0) {
            payouts[passenger] = 0;
            passenger.transfer(payment);
        }
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund(address address_, uint256 amount) external payable
        requireIsOperational()
        requireAppCaller()
        requireRegisteredAirline(address_)
        returns (bool)
    {
        require(amount > 0, "Did not send any funds.");

        airlines[address_].amountFunded = airlines[address_].amountFunded.add(amount);
        totalFunds = totalFunds.add(amount);
        emit AirlineSentFunds(address_, amount, airlines[address_].amountFunded);
        if (airlines[address_].amountFunded >= 10 ether) {
            airlines[address_].isFunded = true;
            numFundedAirlines = numFundedAirlines.add(1);
            emit AirlineFunded(address_, airlines[address_].name);
        }

        return airlines[address_].isFunded;
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getFlightInsuranceKey(address passenger, bytes32 flightKey)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(passenger, flightKey));
    }

    /**
     * @dev Add an app contract that can call into this contract
     */

    function authorizeCaller(address app) external requireContractOwner
    {
        appContracts[app] = true;
    }

    /**
     * @dev Add an app contract that can call into this contract
     */
    function deauthorizeCaller(address app) external requireContractOwner
    {
        delete appContracts[app];
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable
    {

    }
}
