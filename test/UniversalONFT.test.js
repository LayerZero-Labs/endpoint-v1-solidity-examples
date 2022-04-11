const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("UniversalONFT", function () {
    beforeEach(async function () {
        this.accounts = await ethers.getSigners()
        this.owner = this.accounts[0]

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        const UniversalONFT = await ethers.getContractFactory("UniversalONFT")

        this.chainIdSrc = 1
        this.chainIdDst = 2
        this.name = "UniversalONFT"
        this.symbol = "UONFT"

        this.lzEndpointSrcMock = await LZEndpointMock.deploy(this.chainIdSrc)
        this.lzEndpointDstMock = await LZEndpointMock.deploy(this.chainIdDst)

        // create two UniversalONFT instances
        this.UniversalONFTSrc = await UniversalONFT.deploy(
            this.name,
            this.symbol,
            this.lzEndpointSrcMock.address,
            0,
            1
        )
        this.UniversalONFTDst = await UniversalONFT.deploy(
            this.name,
            this.symbol,
            this.lzEndpointDstMock.address,
            1,
            2
        )

        this.lzEndpointSrcMock.setDestLzEndpoint(this.UniversalONFTDst.address, this.lzEndpointDstMock.address)
        this.lzEndpointDstMock.setDestLzEndpoint(this.UniversalONFTSrc.address, this.lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await this.UniversalONFTSrc.setTrustedRemote(this.chainIdDst, this.UniversalONFTDst.address) // for A, set B
        await this.UniversalONFTDst.setTrustedRemote(this.chainIdSrc, this.UniversalONFTSrc.address) // for B, set A
    })

    it("mint on the source chain and send ONFT to the destination chain", async function () {
        // mint UniversalONFT
        let tx = await this.UniversalONFTSrc.mint();
        let onftTokenIdTemp = await ethers.provider.getTransactionReceipt(tx.hash)
        let onftTokenId = parseInt(Number(onftTokenIdTemp.logs[0].topics[3]));

        // verify the owner of the token is on the source chain
        let currentOwner = await this.UniversalONFTSrc.ownerOf(onftTokenId)
        expect(currentOwner).to.be.equal(this.owner.address)

        // approve and send UniversalONFT
        await this.UniversalONFTSrc.approve(this.UniversalONFTSrc.address, onftTokenId)
        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        let adapterParam = ethers.utils.solidityPack(
            ['uint16','uint256'],
            [1, 225000]
        )
        await this.UniversalONFTSrc.send(
            this.chainIdDst,
            ethers.utils.solidityPack(["address"], [this.owner.address]),
            onftTokenId,
            this.owner.address,
            "0x000000000000000000000000000000000000dEaD",
            adapterParam
        )

        // verify the owner of the token is no longer on the source chain
        await expect(this.UniversalONFTSrc.ownerOf(onftTokenId)).to.revertedWith("ERC721: owner query for nonexistent token")

        // verify the owner of the token is on the destination chain
        currentOwner = await this.UniversalONFTDst.ownerOf(onftTokenId)
        expect(currentOwner).to.not.equal(this.owner)

        // hit the max mint on the source chain
        await expect(this.UniversalONFTSrc.mint()).to.revertedWith("ONFT: Max Mint limit reached")
    })
})
