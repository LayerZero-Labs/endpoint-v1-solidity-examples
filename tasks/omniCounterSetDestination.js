const CHAIN_ID = require('../constants/chainIds.json')
const {getDeploymentAddresses} = require('../utils/readStatic')

module.exports = async function (taskArgs, hre) {
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["OmniCounter"]
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`[source] omniCounter.address: ${omniCounter.address}`)

    // setDestination() on the local contract, so it can receive message from the remote contract
    try{
        let tx = await (await omniCounter.setDestination(
            dstChainId,
            dstAddr
        )).wait()
        console.log(`✅ [${hre.network.name}] setDestination(${dstChainId}, ${dstAddr})`)
        console.log(` tx: ${tx.transactionHash}`)
    } catch(e){
        if(e.error?.message.includes("The remote address has already been set for the chainId")){ console.log('*remote already set*') }
        else { console.log(e)}
    }
}
