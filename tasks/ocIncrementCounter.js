const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["OmniCounter"]
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`[source] omniCounter.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    for (let i = 0; i < taskArgs.n; ++i) {
        let tx = await (
            await omniCounter.incrementCounter(
                dstChainId,
                { value: ethers.utils.parseEther("1") } // estimate/guess
            )
        ).wait()
        console.log(`✅ Message Sent [${hre.network.name}] incrementCounter on destination OmniCounter @ [${dstChainId}]`)
        console.log(`[${i}] tx: ${tx.transactionHash}`)
    }

    console.log(``)
    console.log(`Note: to poll/wait for the message to arrive on the destination use the command:`)
    console.log(`       (it may take a minute to arrive, be patient!)`)
    console.log("")
    console.log(`    $ npx hardhat --network ${taskArgs.targetNetwork} ocPoll`)
}
