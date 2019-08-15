pragma solidity ^0.5.11;

import "node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                              // Account used to deploy contract
    bool private operational = true;                            // Blocks all state changes throughout the contract if false
    mapping(address => bool) private appContracts;              // Only authorized app contracts can call this contract.
    mapping(address => bool) private registeredAirlines;        // registered airlines
    mapping(address => bool) private fundedAirlines;            // airlines that have funded the contract
    mapping(address => uint256) private registrationQueue;      // airlines in the queue
    uint256 numAirlines = 0;
    uint256 numFundedAirlines = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address firstAirline) public
    {
        contractOwner = msg.sender;
        registeredAirlines[firstAirline] = true;
        numAirlines++;
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
        require(fundedAirlines[airline], "Caller is not a registered airline");
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

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address sender, address airline)
        external
        requireAppCaller()
        requireFundedAirline(sender)
        returns (bool, uint256)
    {
        if (numFundedAirlines < 4) {
            registeredAirlines[airline] = true;
            numAirlines++;
            return (true, 0);
        }

        // new airline?  add it to the queue
        // in the queue already?
        // if so, increment its vote
        // if the vote is >= fundedAirlines/2, promote it to registered
        uint256 votes = registrationQueue[airline];
        if (votes == 0) {
            registrationQueue[airline] = 1;
            return (false, 1);
        }

        registrationQueue[airline] += 1;
        if (registrationQueue[airline] >= numFundedAirlines.div(2)) {
            registeredAirlines[airline] = true;
            numAirlines++;
            delete registrationQueue[airline];
            return (true, 0);
        } else {
            return (false, votes+1);
        }
    }

    /**
     * @dev Is the airline registered?  Returns (true or false, number of airlines)
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function isAirlineRegistered(address airline) external view requireAppCaller() returns (bool, uint256)
    {
        return (registeredAirlines[airline], numAirlines);
    }

    /**
     * @dev Is the airline funded?  Returns (true or false, number of funded airlines)
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function isAirlineFunded(address airline) external view requireAppCaller() returns (bool, uint256)
    {
        return (fundedAirlines[airline], numFundedAirlines);
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
        pure
        internal
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
