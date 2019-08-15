const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = function(deployer) {

    // hard-coded value, based on wallet seed
    // this is account #1 (#0 is deployer)
    let firstAirline = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';
    let firstAirlineName = 'Airplane!';
    return deployer.deploy(FlightSuretyData, firstAirline, firstAirlineName)
        .then(() => {
            return deployer.deploy(FlightSuretyApp, FlightSuretyData.address);
        })
        .then(() => {
            let config = {
                localhost: {
                    url: 'http://localhost:8545',
                    dataAddress: FlightSuretyData.address,
                    appAddress: FlightSuretyApp.address
                }
            };
            fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '  '), 'utf-8');
            fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '  '), 'utf-8');
        });
};
