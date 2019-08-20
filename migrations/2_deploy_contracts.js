const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async (deployer) => {

    // hard-coded value, based on wallet seed
    // this is account #1 (#0 is deployer)
    let firstAirline = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';
    let firstAirlineName = 'Airplane!';

    await deployer.deploy(FlightSuretyData, firstAirline, firstAirlineName);
    let data = await FlightSuretyData.deployed();

    await deployer.deploy(FlightSuretyApp, data.address);
    let app = await FlightSuretyApp.deployed();

    await data.authorizeCaller(app.address);

    // get the gas limit
    let block = await web3.eth.getBlock("latest");

    let config = {
        localhost: {
            url: 'http://localhost:8545',
            dataAddress: data.address,
            appAddress: app.address,
            gas: block.gasLimit
        }
    };

    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '  '), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '  '), 'utf-8');
};
