const Test = require("../config/testConfig.js");

contract("Flight Registration Tests", async (accounts) => {

    let config;
    before("setup contract", async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    const tenEther = web3.utils.toWei("10", "ether");
    const testFlight = "Flight 101";
    const testTimestamp = 1566359629;

    it("a non-airline address cannot register a flight", async () => {
        let registerFail = false;
        try {
            await config.flightSuretyApp.registerFlight(testFlight, testTimestamp, {from: accounts[0]});
        }
        catch(e) {
            registerFail = true;
        }
        assert.equal(registerFail, true, "Should not be able to register a flight if not an airline");
    });


    it("(first airline) is funded", async () => {
        await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: tenEther});

        result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                        {from: config.flightSuretyApp.address});
        assert.equal(result[0], true, "Airline has sent enough ether to be funded");

    });

    it("a funded airline address can register a flight", async () => {
        let registerSuccess = true;
        try {
            await config.flightSuretyApp.registerFlight(testFlight, testTimestamp, {from: config.firstAirline});
        }
        catch(e) {
            registerSuccess = false;
        }
        assert.equal(registerSuccess, true, "Funded airline should be able to register a flight");
    });

    it("(airline) can register another Airline using registerAirline() if it is funded", async () => {
        let second = accounts[2];

        await config.flightSuretyApp.registerAirline(second, "Air 2", {from: config.firstAirline});

        let result = await config.flightSuretyData.isAirlineRegistered.call(second,
                                                                            {from: config.flightSuretyApp.address});

        assert.equal(result[0], true, "Airline should be registered by another (funded) airline");
    });

    it("a non-funded airline address cannot register a flight", async () => {
        let registerFail = false;
        try {
            await config.flightSuretyApp.registerFlight(testFlight, testTimestamp, {from: accounts[2]});
        }
        catch(e) {
            registerFail = true;
        }
        assert.equal(registerFail, true, "Should not be able to register a flight if not a funded airline");
    });
});
