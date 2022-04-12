const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("UniversalONFT: ", function () {
    let accounts, owner, chainIdSrc, chainIdDst, name, symbol, lzEndpointSrcMock, lzEndpointDstMock, UniversalONFTSrc, UniversalONFTDst

    before(async function () {
        accounts = await ethers.getSigners()
        owner = accounts[0]

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        const UniversalONFT = await ethers.getContractFactory("UniversalONFT")

        chainIdSrc = 1
        chainIdDst = 2
        name = "UniversalONFT"
        symbol = "UONFT"

        lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMock.deploy(chainIdDst)

        // create two UniversalONFT instances
        UniversalONFTSrc = await UniversalONFT.deploy(
            name,
            symbol,
            lzEndpointSrcMock.address,
            0,
            1
        )
        UniversalONFTDst = await UniversalONFT.deploy(
            name,
            symbol,
            lzEndpointDstMock.address,
            1,
            2
        )

        lzEndpointSrcMock.setDestLzEndpoint(UniversalONFTDst.address, lzEndpointDstMock.address)
        lzEndpointDstMock.setDestLzEndpoint(UniversalONFTSrc.address, lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await UniversalONFTSrc.setTrustedRemote(chainIdDst, UniversalONFTDst.address) // for A, set B
        await UniversalONFTDst.setTrustedRemote(chainIdSrc, UniversalONFTSrc.address) // for B, set A
    })

    it("mint on the source chain and send ONFT to the destination chain", async function () {
        // mint UniversalONFT
        let tx = await UniversalONFTSrc.mint();
        let onftTokenIdTemp = await ethers.provider.getTransactionReceipt(tx.hash)
        let onftTokenId = parseInt(Number(onftTokenIdTemp.logs[0].topics[3]));

        // verify the owner of the oft is on the source chain
        let currentOwner = await UniversalONFTSrc.ownerOf(onftTokenId)
        expect(currentOwner).to.be.equal(owner.address)

        // approve and send UniversalONFT
        await UniversalONFTSrc.approve(UniversalONFTSrc.address, onftTokenId)
        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        let adapterParam = ethers.utils.solidityPack(
            ['uint16','uint256'],
            [1, 225000]
        )

        await UniversalONFTSrc.send(
            chainIdDst,
            ethers.utils.solidityPack(["address"], [owner.address]),
            onftTokenId,
            owner.address,
            "0x000000000000000000000000000000000000dEaD",
            adapterParam
        )

        // verify the owner of the oft is no longer on the source chain
        await expect(UniversalONFTSrc.ownerOf(onftTokenId)).to.revertedWith("ERC721: owner query for nonexistent oft")

        // verify the owner of the oft is on the destination chain
        currentOwner = await UniversalONFTDst.ownerOf(onftTokenId)
        expect(currentOwner).to.not.equal(owner)

        // hit the max mint on the source chain
        await expect(UniversalONFTSrc.mint()).to.revertedWith("ONFT: Max Mint limit reached")
    })
})
