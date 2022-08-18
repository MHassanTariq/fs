const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {

    plugins: ["truffle-security"],

    networks: {
        development: {
            provider: function() {
                return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
            },
            network_id: '*',
            gas: 6721975,
            gasPrice: 20000000000
        }
    },
    compilers: {
        solc: {
            version: "0.8.6",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    }
};
