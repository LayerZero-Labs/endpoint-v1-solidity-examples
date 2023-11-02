module.exports = async function (taskArgs, hre) {
    let owner = (await ethers.getSigners())[0]
    let toAddress = owner.address
    let qty = ethers.utils.parseEther(taskArgs.qty)

    const oftMock = await ethers.getContract("OFTMock")

    let tx = await (
        await oftMock.mintTokens(toAddress, qty)
    ).wait()
    console.log(`✅ OFT minted [${hre.network.name}] to: [${toAddress}] qty: [${qty}]`)
}
