const CHAIN_IDS = require("../constants/chainIds.json")
const ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const onft1155 = await ethers.getContract("ONFT1155")
    const dstChainId = CHAIN_IDS[taskArgs.targetNetwork]

    const tokenIds = taskArgs.tokenIds.split(",")
    const quantities = taskArgs.quantities.split(",")
    console.log(tokenIds)
    console.log(quantities)

    const payload =
        "0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000014f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
    const endpoint = await ethers.getContractAt("ILayerZeroEndpoint", ENDPOINTS[hre.network.name])
    let fees = await endpoint.estimateFees(dstChainId, onft1155.address, payload, false, "0x")
    console.log(`fees[0] (wei): ${fees[0]}`)

    let tx = await (
        await onft1155.sendBatch(dstChainId, owner.address, tokenIds, quantities, owner.address, ethers.constants.AddressZero, "0x", {
            value: fees[0],
        })
    ).wait()
    console.log(`send tx: ${tx.transactionHash}`)
}
