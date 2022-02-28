const TYPE_ORACLE = 6

module.exports = async function (taskArgs, hre) {
    // get local contract instance
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`omniCounter.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    let tx = await (await omniCounter.setOracle(
        taskArgs.dstChainId,
        taskArgs.oracle
    )).wait()
    console.log(`... set [${hre.network.name}] OmniCounter `)
    console.log(`tx: ${tx.transactionHash}`)
}
