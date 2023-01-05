const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    console.log(taskArgs)

    let signers = await ethers.getSigners()
    let owner = signers[0]
    console.log(`owner: ${owner.address}`)

    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstStargateComposedAddr = getDeploymentAddresses(taskArgs.targetNetwork)["StargateComposed"]
    console.log(`dstStargateComposedAddr: ${dstStargateComposedAddr}`)

    // get local contract instance
    const stargateComposed = await ethers.getContract("StargateComposed")
    console.log(`[source] stargateComposed.address: ${stargateComposed.address}`)

    let qty = ethers.utils.parseEther(taskArgs.qty) // convert to wei
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 10000

    const quoteData = await router.quoteLayerZeroFee(
        dstChainId,
        1, // function type: see Bridge.sol for all types
        owner.address,
        "0x",  // payload, using abi.encode()
        ({
            dstGasForCall: 50000,   // extra gas, if calling smart contract,
            dstNativeAmount: 0,     // amount of dust dropped in destination wallet 
            dstNativeAddr: "0x"     // destination wallet for dust
        })
    )

    const fee = quoteData[0].mul(10).div(8) // + 20%
    console.log(`fee: ${fee.toString()} wei`)

    let tx = await (
        await stargateComposed.swapNativeForNative(
            dstChainId,
            taskArgs.bridgeToken,
            taskArgs.srcPoolId,
            taskArgs.dstPoolId,
            qty,
            owner.address,
            0,
            0,
            0,
            deadline,
            dstStargateComposed,
            { value: qty.add(fee) }
        )
    ).wait()
    console.log(`tx: ${tx.transactionaHash}`)
}
