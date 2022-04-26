const CHAIN_IDS = require("../constants/chainIds.json")
const ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const proxyONFT1155 = await ethers.getContract("ProxyONFT1155")
    const dstChainId = CHAIN_IDS[taskArgs.targetNetwork]

    const endpoint = await ethers.getContractAt("ILayerZeroEndpoint", ENDPOINTS[hre.network.name])
    let fees = await endpoint.estimateFees(dstChainId, proxyONFT1155.address, "0x", false, "0x")
    console.log(`fees[0]: ${fees[0]}`)

    let tx = await (
        await proxyONFT1155.send(
            dstChainId,
            owner.address,
            taskArgs.tokenId,
            taskArgs.quantity,
            owner.address,
            ethers.constants.AddressZero,
            "0x",
            { value: fees[0] }
        )
    ).wait()
    console.log(`send tx: ${tx.transactionHash}`)
}
