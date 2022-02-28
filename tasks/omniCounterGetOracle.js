const TYPE_ORACLE = 6
module.exports = async function (taskArgs, hre) {
    // get the local contract
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`omniCounter.address: ${omniCounter.address}`)

    // set the config for this UA to use the specified Oracle
    let data = await omniCounter.getConfig(
        0, // unused
        taskArgs.dstChainId,
        omniCounter.address,
        TYPE_ORACLE
    )

    console.log(data)
    console.log(` ^ Oracle ... for (${hre.network.name}) -> [${taskArgs.dstChainId}]`)
}
