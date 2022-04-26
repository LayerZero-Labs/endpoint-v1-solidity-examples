function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis))
}

module.exports = async function (taskArgs, hre) {
    console.log(`owner:`, (await ethers.getSigners())[0].address)
    const omniCounter = await ethers.getContract("OmniCounter")
    console.log(`omniCounter: ${omniCounter.address}`)

    while (true) {
        let counter = await omniCounter.counter()
        console.log(`[${hre.network.name}] ${new Date().toISOString().split("T")[1].split(".")[0]} counter...    ${counter}`)
        await sleep(1000)
    }
}
