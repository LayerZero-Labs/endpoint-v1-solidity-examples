const ENDPOINT_IDS = require('../constants/endpointIds.json')
const {getDeploymentAddresses} = require("../utils/readStatic");

module.exports = async function (taskArgs, hre) {
    const dstChainId = ENDPOINT_IDS[taskArgs.targetNetwork]
    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["PingPong"]
    console.log(`destination address: ${dstAddr}`)
    // get local contract instance
    const pingPong = await ethers.getContract("PingPong")
    console.log(`pingPong.address: ${pingPong.address}`)

    console.log(`start pings from ${hre.network.name} to chain ${dstChainId} dstAddr ${dstAddr}`)

    // set the config for this UA to use the specified Oracle
    let tx = await (await pingPong.ping(
        dstChainId,
        dstAddr,
        0 // start pings at 0
    )).wait()

    console.log(`tx: ${tx.transactionHash}`)
}
