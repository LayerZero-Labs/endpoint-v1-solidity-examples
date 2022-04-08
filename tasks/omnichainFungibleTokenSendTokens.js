const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    let signers = await ethers.getSigners()
    let owner = signers[0]
    let tx
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const qty = ethers.utils.parseEther(taskArgs.qty)

    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["OmnichainFungibleToken"]
    // get local contract instance
    const omnichainFungibleToken = await ethers.getContract("OmnichainFungibleToken")
    console.log(`[source] omnichainFungibleToken.address: ${omnichainFungibleToken.address}`)

    tx = await (await omnichainFungibleToken.approve(omnichainFungibleToken.address, qty)).wait()
    console.log(`approve tx: ${tx.transactionHash}`)

    let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 2000000])

    tx = await (
        await omnichainFungibleToken.sendTokens(
            dstChainId,
            owner.address,
            qty,
            "0x000000000000000000000000000000000000dEaD",
            adapterParams,
            { value: ethers.utils.parseEther("1") } // estimate/guess
        )
    ).wait()
    console.log(`✅ Message Sent [${hre.network.name}] sendTokens() to OmnichainFungibleToken @ [${dstChainId}] token:[${dstAddr}]`)
    console.log(` tx: ${tx.transactionHash}`)
    console.log(`* check your address [${owner.address}] on the destination chain, in the ERC20 transaction tab !"`)
}
