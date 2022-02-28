require("dotenv").config();

require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");

require('hardhat-gas-reporter');
require('./tasks/deploy');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function getMnemonic(networkName) {
  if (networkName) {
    const mnemonic = process.env['MNEMONIC_' + networkName.toUpperCase()]
    if (mnemonic && mnemonic !== '') {
      return mnemonic
    }
  }

  const mnemonic = process.env.MNEMONIC
  if (!mnemonic || mnemonic === '') {
    return 'test test test test test test test test test test test junk'
  }
  return mnemonic
}

function accounts(chainKey) {
  return { mnemonic: getMnemonic(chainKey) }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {

  solidity: "0.8.4",
  contractSizer: {
    alphaSort: false,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  networks: {
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      chainId: 80001,
      accounts: accounts(),
    },

    fuji: {
      url: `https://api.avax-test.network/ext/bc/C/rpc`,
      chainId: 43113,
      accounts: accounts(),
    }
  }

};
