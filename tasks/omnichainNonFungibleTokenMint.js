module.exports = async function (taskArgs, hre) {
    const omnichainNonFungibleToken = await ethers.getContract("OmnichainNonFungibleToken")
    console.log(`[source] omnichainNonFungibleToken.address: ${omnichainNonFungibleToken.address}`)

    try {
        let tx = await (await omnichainNonFungibleToken.mint()).wait()
        console.log(`✅ [${hre.network.name}] mint()`)
        console.log(` tx: ${tx.transactionHash}`)
        let onftTokenId = await ethers.provider.getTransactionReceipt(tx.transactionHash)
        console.log(` Omnichain Non Fungible Token Id: ${parseInt(Number(onftTokenId.logs[0].topics[3]))}`)
    } catch(e){
        if(e.error?.message.includes("ONFT: Max limit reached")){ console.log('*ONFT: Max limit reached*') }
        else { console.log(e)}
    }
}
