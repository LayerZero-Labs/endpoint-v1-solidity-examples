const { getDeploymentAddresses } = require("../utils/readStatic")
const CHAIN_ID = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
    console.log(`[gasAmount]: `, taskArgs.gasAmount)
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["OmniCounter"]
    const omniCounter = await ethers.getContract("OmniCounter")

    let tx = await (
        await omniCounter.incrementCounterWithAdapterParamsV1(
            dstChainId,
            dstAddr,
            taskArgs.gasAmount,
            { value: ethers.utils.parseEther("1") } // estimate/guess
        )
    ).wait()

    console.log(
        `✅ Message Sent [${hre.network.name}] omniCounterIncrementWithParamsV1 on destination OmniCounter @ [${dstChainId}] [${dstAddr}]`
    )
    console.log(`tx: ${tx.transactionHash}`)

    console.log(``)
    console.log(`Note: to poll/wait for the message to arrive on the destination use the command:`)
    console.log("")
    console.log(`    $ npx hardhat --network ${taskArgs.targetNetwork} omniCounterPoll`)
}
