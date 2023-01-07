const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    console.log(taskArgs)

    let signers = await ethers.getSigners()
    let owner = signers[0]
    let tx

    const erc20 = await ethers.getContractAt("ERC20", taskArgs.bridgeToken)
    console.log(`[${hre.network.name}] ERC20: ${erc20.address}`)
    const qty = taskArgs.qty
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
    const dstStargateSwapAddr = getDeploymentAddresses(taskArgs.targetNetwork)["StargateSwap"]
    // get source contract instance
    const stargateSwap = await ethers.getContract("StargateSwap")
    console.log(`[${hre.network.name}] StargateSwap: ${stargateSwap.address}`)
    console.log(`[${taskArgs.targetNetwork}] StargateSwap: ${dstStargateSwapAddr}`)    

    tx = await (await erc20.approve(stargateSwap.address, qty)).wait()
    console.log(`[${hre.network.name}] approve tx: ${tx.transactionHash}`)

    const stargateRouterAddress = await stargateSwap.stargateRouter()
    console.log(`[${hre.network.name}] StargateRouter: ${stargateRouterAddress}`)
    const stargateRouter = await ethers.getContractAt("IStargateRouter", stargateRouterAddress)
    const quoteData = await stargateRouter.quoteLayerZeroFee(
        dstChainId, 
        1, // function type: see Bridge.sol for all types
        owner.address, 
        "0x", // payload
        {
            dstGasForCall: 20000, // extra gas, if calling smart contract,
            dstNativeAmount: 0,   // amount of dust dropped in destination wallet
            dstNativeAddr: "0x",  // destination wallet for dust
        }
    )

    const fee = quoteData[0].mul(10).div(8) // + 20%
    console.log(`[${hre.network.name}] Stargate fee: ${fee.toString()} wei`)

    tx = await (
        await stargateSwap.swap(
            qty,
            taskArgs.bridgeToken,
            dstChainId,
            taskArgs.srcPoolId,
            taskArgs.dstPoolId,
            owner.address, // to address on destination
            dstStargateSwapAddr,
            { value: fee }
        )
    ).wait()
    console.log(`tx: ${tx.transactionHash}`)   
}
