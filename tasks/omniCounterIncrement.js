module.exports = async function (taskArgs, hre) {
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`omniCounter.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    let tx = await (await omniCounter.incrementCounter(
        taskArgs.dstChainId,
        taskArgs.dstAddr,
        {value: ethers.utils.parseEther('0.01')} // estimate/guess
    )).wait()
    console.log(`... from [${hre.network.name}] incrementCounter on destination [${taskArgs.dstAddr}] OmniCounter `)
    console.log(`tx: ${tx.transactionHash}`)
}
