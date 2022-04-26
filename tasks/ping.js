const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstPingPongAddr = getDeploymentAddresses(taskArgs.targetNetwork)["PingPong"]
    // get local contract instance
    const pingPong = await ethers.getContract("PingPong")
    console.log(`[source] pingPong.address: ${pingPong.address}`)

    let tx = await (
        await pingPong.ping(
            dstChainId,
            dstPingPongAddr,
            0 // start at 0 pings counter
        )
    ).wait()
    console.log(`✅ Pings started! [${hre.network.name}] pinging with target chain [${dstChainId}] @ [${dstPingPongAddr}]`)
    console.log(`...tx: ${tx.transactionHash}`)
}
