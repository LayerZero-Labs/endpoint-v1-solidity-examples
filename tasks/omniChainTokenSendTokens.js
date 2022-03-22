const CHAIN_ID = require('../constants/chainIds.json')
const {getDeploymentAddresses} = require('../utils/readStatic')

module.exports = async function (taskArgs, hre) {
    let signers = await ethers.getSigners();
    let owner = signers[0];
    let tx;
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const qty = ethers.utils.parseEther(taskArgs.qty);

    const dstAddr = getDeploymentAddresses(taskArgs.targetNetwork)["OmniChainToken"]
    // get local contract instance
    const omniChainToken = await ethers.getContract("OmniChainToken")
    console.log(`[source] omniChainToken.address: ${omniChainToken.address}`)

    tx = await(await omniChainToken.approve(omniChainToken.address, qty)).wait()
    console.log(`approve tx: ${tx.transactionHash}`)

    tx = await (await omniChainToken.sendTokens(
        dstChainId,
        dstAddr,
        qty,
        {value: ethers.utils.parseEther('1')} // estimate/guess
    )).wait()
    console.log(`✅ Message Sent [${hre.network.name}] sendTokens() to OmniChainToken @ [${dstChainId}] token:[${dstAddr}]`)
    console.log(` tx: ${tx.transactionHash}`)
    console.log(`* check your address [${owner.address}] on the destination chain, in the ERC20 transaction tab !"`)
}
