module.exports = async function (taskArgs, hre) {
    const ERC1155 = await ethers.getContractFactory("ERC1155")
    const erc1155 = await ERC1155.attach(taskArgs.addr)
    const proxyONFT1155 = await ethers.getContract("ProxyONFT1155")
    let tx = await (await erc1155.setApprovalForAll(proxyONFT1155.address, true)).wait()
    console.log(`setApprovalForAll tx: ${tx.transactionHash}`)
}
