const Test = require("../config/testConfig.js");

contract("Flight Surety Tests", async (accounts) => {

    let config;
    before("setup contract", async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    const fiveEther = web3.utils.toWei("5", "ether");

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();

        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try
        {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try
        {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSuretyData.fundAirline(config.firstAirline, fiveEther,
                                                      {from: config.flightSuretyApp.address});
        }
        catch (e) {
            reverted = true;
        }

        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);
    });

    it("(first airline) is registered but not funded", async () => {
        let result = await config.flightSuretyData.isAirlineRegistered.call(config.firstAirline,
                                                                            {from: config.flightSuretyApp.address});

        // ASSERT
        assert.equal(result[0], true, "First airline is registered when the contract is deployed");
        assert.equal(result[1], 1, "First airline is the only registered airline");

        result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                    {from: config.flightSuretyApp.address});

        // ASSERT
        assert.equal(result[0], false, "First airline is not automatically funded when the contract is deployed");
        assert.equal(result[1], 0, "There are no funded airlines");
    });


    it("(airline) is not funded if it sends less than 10 ether", async () => {
        let tx = await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: fiveEther});
        let result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                        {from: config.flightSuretyApp.address});

        assert.equal(result[0], false, "Airline has not sent enough ether to be funded");
    });

    it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {

        // ARRANGE
        let newAirline = accounts[2];
        let reverted = false;

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(newAirline, "Air 2", {from: config.firstAirline});
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Should be reverted");

        let result = await config.flightSuretyData.isAirline.call(newAirline,
                                                                  {from: config.flightSuretyApp.address});

        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });

    it("(airline) is funded if it sends 10 or more more ether", async () => {
        // have already sent 5 ether
        let tx = await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: fiveEther});
        let result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                        {from: config.flightSuretyApp.address});
        assert.equal(result[0], true, "Airline has sent enough ether to be funded");
    });

    it("(airline) can register another Airline using registerAirline() if it is funded", async () => {
        let newAirline = accounts[2];

        await config.flightSuretyApp.registerAirline(newAirline, "Air 2", {from: config.firstAirline});

        let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline,
                                                                            {from: config.flightSuretyApp.address});

        assert.equal(result[0], true, "Airline should be registered by another (funded) airline");

        result = await config.flightSuretyData.isAirlineFunded.call(newAirline,
                                                                        {from: config.flightSuretyApp.address});

        // ASSERT
        assert.equal(result[0], false, "Airline should not be funded at registration");

    });
});
