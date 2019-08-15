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
    }

    address private contractOwner;                      // Account used to deploy contract
    bool private operational = true;                    // Blocks all state changes throughout the contract if false
    mapping(address => bool) private appContracts;      // Only authorized app contracts can call this contract.
    mapping(address => Airline) private airlines;       // registered airlines
    mapping(address => uint256) private votes;          // airlines in the queue and their votes
    mapping(address => address[]) private voters;       // count of voters for an airline
    uint256 numAirlines = 0;
    uint256 numFundedAirlines = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


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
        return Airline({airline: account, name: name_, isRegistered: false, isFunded: false});
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address sender, address address_, string calldata name_)
        external
        requireIsOperational
        requireAppCaller()
        requireFundedAirline(sender)
        returns (bool, uint256)
    {
        if (numFundedAirlines < 4) {
            Airline memory a = newAirline(address_, name_);
            a.isRegistered = true;
            airlines[address_] = a;
            numAirlines = numAirlines.add(1);
            return (true, 0);
        }

        // new airline?  add it to the queue
        // in the queue already?
        // if so, increment its vote
        // if the vote is >= fundedAirlines/2, promote it to registered
        uint256 numVotes = votes[address_];
        if (numVotes == 0) {
            Airline memory a = newAirline(address_, name_);
            a.isRegistered = false;
            airlines[address_] = a;
            voters[address_] = new address[](0);
            voters[address_].push(msg.sender);
            numAirlines = numAirlines.add(1);
            votes[address_] = 1;
            return (false, 1);
        }

        // has msg.sender voted for this airline before?
        address[] memory voted = voters[address_];
        bool found = false;
        for (uint idx = 0; idx < voted.length; idx++) {
            if (msg.sender == voted[idx]) {
                found = true;
                break;
            }
        }

        require(!found, "Have already voted for this airline");

        votes[address_] = votes[address_].add(1);
        if (votes[address_] >= numFundedAirlines.div(2)) {
            airlines[address_].isRegistered = true;
            delete votes[address_];
            delete voters[address_];
            return (true, 0);
        } else {
            return (false, numVotes+1);
        }
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


    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy() external payable
    {
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees() external pure
    {
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external pure
    {
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable
    {
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp)
        internal
        pure
        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
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
        fund();
    }
}
