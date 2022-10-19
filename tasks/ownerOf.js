module.exports = async function (taskArgs, hre) {
    let contract = await ethers.getContract(taskArgs.contract)
    let tokenId = taskArgs.tokenId

    try {
        let address = await contract.ownerOf(tokenId)
        console.log(`✅ [${hre.network.name}] ownerOf(${tokenId})`)
        console.log(` Owner address: ${address}`)
    } catch (e) {
        if(e?.reason) {
            console.log(e.reason)
        } else {
            console.log(e)
        }
    }
}
