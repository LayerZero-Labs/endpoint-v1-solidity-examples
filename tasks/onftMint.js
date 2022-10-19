module.exports = async function (taskArgs, hre) {
    let contract = await ethers.getContract(taskArgs.contract)

    try {
        let tx = await (await contract.mint()).wait()
        console.log(`✅ [${hre.network.name}] mint()`)
        console.log(` tx: ${tx.transactionHash}`)
        let onftTokenId = await ethers.provider.getTransactionReceipt(tx.transactionHash)
        console.log(` ONFT nftId: ${parseInt(Number(onftTokenId.logs[0].topics[3]))}`)
    } catch (e) {
        if (e.error?.message.includes("ONFT: Max limit reached")) {
            console.log("*ONFT: Max limit reached*")
        } else {
            console.log(e)
        }
    }
}

// npx hardhat --network bsc-testnet onftMint --contract ExampleUniversalONFT721
// npx hardhat --network fuji onftMint --contract ExampleUniversalONFT721