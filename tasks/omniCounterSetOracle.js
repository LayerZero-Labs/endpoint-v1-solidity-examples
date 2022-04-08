const CHAIN_ID = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`omniCounter.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    let tx = await (await omniCounter.setOracle(dstChainId, taskArgs.oracle)).wait()
    console.log(`... set Oracle[${taskArgs.oracle}] for [${hre.network.name}] OmniCounter -> dst [${dstChainId}]`)
    console.log(`tx: ${tx.transactionHash}`)
}
