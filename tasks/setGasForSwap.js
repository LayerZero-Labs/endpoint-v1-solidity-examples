
module.exports = async function (taskArgs, hre) {
    const stargateSwap = await ethers.getContract("StargateSwap")
    const tx = await( await stargateSwap.setGasForSwap(taskArgs.gas)).wait()
    console.log(`stargateSwap.setGasForSwap(${taskArgs.gas}) | tx: ${tx.transactionHash}`)
}
