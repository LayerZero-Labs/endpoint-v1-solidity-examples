module.exports = async function (taskArgs, hre) {
    const tokenId = taskArgs.tokenId
    const omnichainNonFungibleToken = await ethers.getContract("OmnichainNonFungibleToken")
    console.log(`[source] omnichainNonFungibleToken.address: ${omnichainNonFungibleToken.address}`)

    try {
        let address = await omnichainNonFungibleToken.ownerOf(
            tokenId
        )
        console.log(`✅ [${hre.network.name}] ownerOf(${tokenId})`)
        console.log(` address: ${address}`)
    } catch(e){
        // console.log(e)

        if(e.error?.message.includes("ERC721: owner query for nonexistent token")){ console.log('*ERC721: owner query for nonexistent token.*') }
        if(e.reason.includes("nonexistent")){console.log('*ERC721: owner query for nonexistent token.*')}
        else {console.log(e)}
    }
}
