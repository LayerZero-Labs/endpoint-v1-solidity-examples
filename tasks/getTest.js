const CHAIN_ID = require("../constants/chainIds.json")

const TYPE_ORACLE = 6

module.exports = async function (taskArgs, hre) {
    const ONFT721Upgradeable = await ethers.getContractFactory("contracts/token/onft/ONFT721UpgradeableV2.sol:ONFT721UpgradeableV2")
    const onft721Upgradeable = await ONFT721Upgradeable.attach('0xaa91835c115DF128b36Ce2114247cA224AB82aE3');
    console.log(`onft721Upgradeable.address: ${onft721Upgradeable.address}`)

    // set the config for this UA to use the specified Oracle
    // let data = await onft721Upgradeable.testOne();
    // console.log(`onft721Upgradeable.testOne(): ${data}`)
    data = await onft721Upgradeable.testTwo();
    console.log(`onft721Upgradeable.testTwo(): ${data}`)
}

