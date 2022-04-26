const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    const targetNetworks = taskArgs.targetNetworks.split(",")
    const dstChainIdArray = []
    const dstAddrArray = []
    // CHAIN_ID[taskArgs.targetNetwork]
    console.log("taskArgs.targetNetwork: " + taskArgs.targetNetworks)
    for (const dst of targetNetworks) {
        console.log("dst: " + dst)
        dstChainIdArray.push(CHAIN_ID[dst])
        dstAddrArray.push(getDeploymentAddresses(dst)["OmniCounter"])
    }
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`[source] omniCounter.address: ${omniCounter.address}`)
    console.log({ dstChainIdArray })
    console.log({ dstAddrArray })

    // set the config for this UA to use the specified Oracle
    let tx = await (
        await omniCounter.incrementMultiCounter(
            dstChainIdArray,
            dstAddrArray,
            (
                await ethers.getSigners()
            )[0].address,
            { value: ethers.utils.parseEther("1") } // estimate/guess
        )
    ).wait()

    let index = 0
    for (const dst of targetNetworks) {
        console.log(
            `✅ Message Sent [${hre.network.name}] incrementMultiCounter on destination OmniCounter @ [${dstChainIdArray[index]}] [${dstAddrArray[index]}]`
        )
        index++
    }
    console.log(`tx: ${tx.transactionHash}`)

    console.log(``)
    console.log(`Note: to poll/wait for the message to arrive on the destination use the command:`)
    console.log("")
    for (const dst of targetNetworks) {
        console.log(`    $ npx hardhat --network ${dst} omniCounterPoll`)
    }
}
