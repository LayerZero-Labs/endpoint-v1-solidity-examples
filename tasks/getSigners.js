module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    for (let i = 0; i < taskArgs.n; ++i) {
        console.log(`${i}) ${signers[i].address}`)
    }
}
