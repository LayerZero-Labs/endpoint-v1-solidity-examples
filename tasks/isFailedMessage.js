module.exports = async function (taskArgs, hre) {
    console.log({ taskArgs })
    const nonBlockingApp = await ethers.getContractAt("NonblockingLzApp", taskArgs.desAddress)

    // concat remote and local address
    let remoteAndLocal = hre.ethers.utils.solidityPack(["address", "address"], [taskArgs.srcAddress, taskArgs.desAddress])

    let bool = await nonBlockingApp.failedMessages(taskArgs.srcChainId, remoteAndLocal, taskArgs.nonce)
    console.log(`failedMessages: ${bool}`)
}

// npx hardhat failedMessage --network fuji --src-chain-id TBD --src-address TBD --des-address TBD --nonce TBD
// npx hardhat failedMessage --network fuji --src-chain-id 101 --src-address 0x165192f89ea752f597203eeb14e8f5538bce799d --des-address 0x9add6f279394f7f3c7a61d3426a7f45e149261a4 --nonce 10
