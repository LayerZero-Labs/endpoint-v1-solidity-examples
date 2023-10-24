const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    const targetNetwork = taskArgs.targetNetwork
    const totalPings = taskArgs.n

    const dstChainId = CHAIN_ID[targetNetwork]
    const dstPingPongAddr = getDeploymentAddresses(targetNetwork)["PingPong"]

    // get local contract instance
    const pingPong = await ethers.getContract("PingPong")
    console.log(`[source] pingPong.address: ${pingPong.address}`)

    let tx = await (await pingPong.ping(dstChainId, totalPings)).wait()

    console.log(`✅ Pings started! [${hre.network.name}] pinging with target chain [${dstChainId}] @ [${dstPingPongAddr}]`)
    console.log(`...tx: ${tx.transactionHash}`)
}
