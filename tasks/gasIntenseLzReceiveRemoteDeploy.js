const ENDPOINT_IDS = require('../constants/endpointIds.json')
const {getDeploymentAddresses} = require('../utils/readStatic')

module.exports = async function (taskArgs, hre) {
    console.log(taskArgs)
    const dstChainId = ENDPOINT_IDS[taskArgs.targetNetwork]

    console.log(`[destination] GasIntenseLzReceive`, getDeploymentAddresses(taskArgs.targetNetwork))
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["GasIntenseLzReceive"]
    // get local contract instance
    const omniCounter = await ethers.getContract("GasIntenseLzReceive")
    console.log(`[source] GasIntenseLzReceive.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    let tx = await (await omniCounter.deployRemote(
        dstChainId,
        dstAddr,
        taskArgs.gas,
        {value: ethers.utils.parseEther('2')} // estimate/guess message cost
    )).wait()
    console.log(`✅ Message Sent [${hre.network.name}] deployRemote on destination GasIntenseLzReceive @ [${dstChainId}] [${dstAddr}]`)
    console.log(`  tx: ${tx.transactionHash}`)
}
