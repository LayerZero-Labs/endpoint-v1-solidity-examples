const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["ExampleUniversalONFT721"]
    const exampleUniversalONFT = await ethers.getContract("ExampleUniversalONFT721")
    console.log(`[source] exampleUniversalONFT721.address: ${exampleUniversalONFT.address}`)

    // setTrustedRemote() on the local contract, so it can receive message from the source contract
    try {
        let tx = await (await exampleUniversalONFT.setTrustedRemote(dstChainId, dstAddr)).wait()
        console.log(`✅ [${hre.network.name}] setTrustedRemote(${dstChainId}, ${dstAddr})`)
        console.log(` tx: ${tx.transactionHash}`)
    } catch (e) {
        if (e.error.message.includes("The trusted source address has already been set for the chainId")) {
            console.log("*trusted source already set*")
        } else {
            console.log(e)
        }
    }
}
