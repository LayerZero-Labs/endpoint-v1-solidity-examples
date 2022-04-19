const CHAIN_IDS = require('../constants/chainIds.json')

module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const proxyONFT1155 = await ethers.getContract("ProxyONFT1155")
    const dstChainId = CHAIN_IDS[taskArgs.targetNetwork]
    let tx = await (await proxyONFT1155.send(
        dstChainId,
        owner.address,
        taskArgs.tokenId,
        taskArgs.quantity,
        owner.address,
        ethers.constants.AddressZero,
        "0x",
        { value: ethers.utils.parseEther(taskArgs.msgValue) }
    )).wait()
    console.log(`send tx: ${tx.transactionHash}`)
}