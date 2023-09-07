const ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function (taskArgs, hre) {
    const EndpointAbi = [
        "function storedPayload(uint16, bytes) external view returns (uint64, address, bytes32)",
        "function hasStoredPayload(uint16, bytes calldata) external view returns (bool)",
        "function retryPayload(uint16, bytes, bytes)",
    ]

    // console.log({taskArgs})
    const endpoint = await ethers.getContractAt(EndpointAbi, ENDPOINTS[hre.network.name])

    // concat remote and local address
    let remoteAndLocal = hre.ethers.utils.solidityPack(["address", "address"], [taskArgs.srcAddress, taskArgs.desAddress])

    let bool = await endpoint.hasStoredPayload(taskArgs.srcChainId, remoteAndLocal)
    console.log(bool)
    if (bool && taskArgs.clear) {
        let payload = "0x" + taskArgs.payload
        let tx = await (await endpoint.retryPayload(taskArgs.srcChainId, remoteAndLocal, payload)).wait()
        console.log(`tx: ${tx.transactionHash}`)
    }
}

// npx hardhat storedPayload --network polygon --src-chain-id TBD --src-address TBD --des-address TBD
// npx hardhat storedPayload --network polygon --src-chain-id 101 --src-address 0x165192f89ea752f597203eeb14e8f5538bce799d --des-address 0x9add6f279394f7f3c7a61d3426a7f45e149261a4
