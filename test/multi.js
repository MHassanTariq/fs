const Test = require("../config/testConfig.js");

contract("Airline Registration and Multiparty Consensus Tests", async (accounts) => {

    let config;
    before("setup contract", async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    const tenEther = web3.utils.toWei("10", "ether");
    const tenEtherPlus = web3.utils.toWei("10001", "milli");

    it("(first airline) is registered but not funded", async () => {
        let result = await config.flightSuretyData.isAirlineRegistered.call(config.firstAirline,
                                                                            {from: config.flightSuretyApp.address});

        assert.equal(result[0], true, "First airline should be registered when the contract is deployed");
        assert.equal(result[1], 1, "First airline should be the only registered airline");

        result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                    {from: config.flightSuretyApp.address});

        assert.equal(result[0], false, "First airline should not automatically funded when the contract is deployed");
        assert.equal(result[1], 0, "There should be no funded airlines");
    });

    it("(first airline) cannot register an Airline using registerAirline() if it is not funded", async () => {

        // ARRANGE
        let newAirline = accounts[2];
        let reverted = false;

        // ACT
        try {
            await config.flightSuretyApp.registerAirline.call(newAirline, "Air 2", {from: config.firstAirline});
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Should be reverted");

        let result = await config.flightSuretyData.isAirline.call(newAirline,
                                                                  {from: config.flightSuretyApp.address});

        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });

    it("airline is funded if it sends 10 or more ether", async () => {
        await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: tenEtherPlus});
        let result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline,
                                                                        {from: config.flightSuretyApp.address});
        assert.equal(result[0], true, "Airline has sent enough ether to be funded");
    });

    it("(airline) can register another Airline using registerAirline() if it is funded", async () => {
        let second = accounts[2];

        await config.flightSuretyApp.registerAirline(second, "Air 2", {from: config.firstAirline});

        let result = await config.flightSuretyData.isAirlineRegistered.call(second,
                                                                            {from: config.flightSuretyApp.address});

        assert.equal(result[0], true, "Airline should be registered by another (funded) airline");
    });

    it("(second airline) is registered but not funded at registration", async () => {
        let second = accounts[2];

        result = await config.flightSuretyData.isAirlineFunded.call(second,
                                                                    {from: config.flightSuretyApp.address});
        assert.equal(result[0], false, "Second airline should not be funded at registration");
    });

    it("(second airline) can register third and fourth if funded", async () => {
        let second = accounts[2];
        let third = accounts[3];
        let fourth = accounts[4];
        let airlineNumber = 2;

        await config.flightSuretyApp.fundAirline({from: second, value: tenEther});

        let result = await config.flightSuretyData.isAirlineFunded.call(second,
                                                                        {from: config.flightSuretyApp.address});
        assert.equal(result[0], true, "Second airline should be funded");

        await config.flightSuretyApp.registerAirline(third, `Air ${airlineNumber}`, {from: second});
        airlineNumber++;
        await config.flightSuretyApp.registerAirline(fourth, `Air ${airlineNumber}`, {from: second});

        let r3 = await config.flightSuretyData.isAirlineRegistered.call(third,
                                                                        {from: config.flightSuretyApp.address});
        let r4 = await config.flightSuretyData.isAirlineRegistered.call(fourth,
                                                                        {from: config.flightSuretyApp.address});

        assert.equal(r3[0], true, "Airline should be registered by second airline");
        assert.equal(r4[0], true, "Airline should be registered by second airline");
    });

    it("fund third and fourth airlines to switch to multiparty", async () => {
        let third = accounts[3];
        let fourth = accounts[4];

        await config.flightSuretyApp.fundAirline({from: third, value: tenEther});
        await config.flightSuretyApp.fundAirline({from: fourth, value: tenEther});

        let r3 = await config.flightSuretyData.isAirlineFunded.call(third,
                                                                    {from: config.flightSuretyApp.address});
        let r4 = await config.flightSuretyData.isAirlineFunded.call(fourth,
                                                                    {from: config.flightSuretyApp.address});

        assert.equal(r3[0], true, "Third Airline should be funded");
        assert.equal(r4[0], true, "Fourth Airline should be funded");
    });

    it("airlines five and six can register themselves in multiparty mode with zero votes", async () => {
        let second = accounts[2];
        let fifth = accounts[5];
        let sixth = accounts[6];
        let airlineNumber = 2;

        await config.flightSuretyApp.registerAirline(fifth, `Air ${airlineNumber}`, {from: fifth});
        airlineNumber++;
        await config.flightSuretyApp.registerAirline(sixth, `Air ${airlineNumber}`, {from: sixth});

        let r5 = await config.flightSuretyApp.numVotes.call(fifth, {from: fifth});
        let r6 = await config.flightSuretyApp.numVotes.call(fifth, {from: second});

        assert.equal(r5, 0, "Airline registering itself should not have any votes");
        assert.equal(r6, 0, "Airline registering itself should not have any votes");
    });

    it("airline registered in multiparty mode by itself does not list itself as a voter", async () => {
        let fifth = accounts[5];

        let r5 = await config.flightSuretyApp.hasVoted.call(fifth, {from: fifth});

        assert.equal(r5, false, "Airline registered by funded airline should not its own vote");
    });

    it("airline registered in multiparty mode by funded airline has one vote", async () => {
        let second = accounts[2];
        let seventh = accounts[7];
        let airlineNumber = 7;

        await config.flightSuretyApp.registerAirline(seventh, `Air ${airlineNumber}`, {from: second});
        let r7 = await config.flightSuretyApp.numVotes.call(seventh, {from: seventh});

        assert.equal(r7, 1, "Airline registered by funded airline should have 1 vote");
    });

    it("airline registered in multiparty mode by funded airline lists funded airline as voter", async () => {
        let second = accounts[2];
        let seventh = accounts[7];

        let r2 = await config.flightSuretyApp.hasVoted.call(seventh, {from: second});
        let r7 = await config.flightSuretyApp.hasVoted.call(seventh, {from: seventh});

        assert.equal(r2, true, "Airline registered by funded airline should store funded airline's vote");
        assert.equal(r7, false, "Airline registered by funded airline should not store its own vote");
    });

    // at this point, airlines 1-4 are funded
    // 5 and 6 have 0 votes, not registered
    // 7 has 1 vote (2), not registered
    // numFundedAirlines is 4
    it("(internal) check if the state of the data contract is what it should be", async () => {
        // first entry in each array is a dummy value so the indexes we use below are in sync
        let regresults = [null];
        let fundresults = [null];
        // note: i starts from 1 because we are looking at accounts[1] onwards (airlines)
        for (let i = 1; i < 8; i++) {
            regresults.push(await config.flightSuretyData.isAirlineRegistered.call(accounts[i],
                                                                                   {from: config.flightSuretyApp.address}));
            fundresults.push(await config.flightSuretyData.isAirlineFunded.call(accounts[i],
                                                                                {from: config.flightSuretyApp.address}));
        }

        // note: i starts from 1 because we are looking at accounts[1] onwards (airlines)
        // and item #0 is a dummy value (padding)

        for (let i = 1; i < 5; i++) {
            assert.equal(regresults[i][0], true, `Airline ${i} should be registered`);
            assert.equal(fundresults[i][0], true, `Airline ${i} should be funded`);
        }

        for (let i = 5; i < 8; i++) {
            assert.equal(regresults[i][0], false, `Airline ${i} should not be registered`);
            assert.equal(fundresults[i][0], false, `Airline ${i} should not be funded`);
        }

        for (let i = 5; i < 7; i++) {
            let votes = await config.flightSuretyApp.numVotes.call(accounts[i]);
            assert.equal(votes, 0, `Airline ${i} should have no votes; has ${votes}`);
        }

        let v7 = await config.flightSuretyApp.numVotes.call(accounts[7]);
        assert.equal(v7, 1, `Airline 7 should have one vote; has ${v7}`);

        let numairlines = await config.flightSuretyData.numAirlines.call();
        assert.equal(numairlines, 7, `Number of airlines is wrong: ${numairlines}`);

        let numfunded = await config.flightSuretyData.numFundedAirlines.call();
        assert.equal(numfunded, 4, `Number of funded airlines is wrong: ${numfunded}`);
    });
});
