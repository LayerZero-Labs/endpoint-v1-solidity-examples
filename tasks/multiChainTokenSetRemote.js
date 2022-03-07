const ENDPOINT_IDS = require('../constants/endpointIds.json')
const {getDeploymentAddresses} = require('../utils/readStatic')

module.exports = async function (taskArgs, hre) {
    const dstChainId = ENDPOINT_IDS[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["MultiChainToken"]
    // get local contract instance
    const multiChainToken = await ethers.getContract("MultiChainToken")
    console.log(`[source] multiChainToken.address: ${multiChainToken.address}`)

    // setRemote() on the local contract, so it can receive message from the remote contract
    try {
        let tx = await (await multiChainToken.setRemote(
            dstChainId,
            dstAddr
        )).wait()
        console.log(`✅ [${hre.network.name}] setRemote(${dstChainId}, ${dstAddr})`)
        console.log(` tx: ${tx.transactionHash}`)
    } catch(e){
        if(e.error.message.includes("The remote address has already been set for the chainId")){ console.log('*remote already set*') }
        else { console.log(e)}
    }
}
