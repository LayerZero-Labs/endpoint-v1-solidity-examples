const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("OmnichainNonFungibleToken", function () {
    beforeEach(async function () {
        this.accounts = await ethers.getSigners()
        this.owner = this.accounts[0]

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        const OmnichainNonFungibleToken = await ethers.getContractFactory("OmnichainNonFungibleToken")

        this.chainIdSrc = 1
        this.chainIdDst = 2

        this.lzEndpointSrcMock = await LZEndpointMock.deploy(this.chainIdSrc)
        this.lzEndpointDstMock = await LZEndpointMock.deploy(this.chainIdDst)

        // create two OmnichainNonFungibleToken instances
        this.OmnichainNonFungibleTokenSrc = await OmnichainNonFungibleToken.deploy(
            this.lzEndpointSrcMock.address,
            0,
            1
        )
        this.OmnichainNonFungibleTokenDst = await OmnichainNonFungibleToken.deploy(
            this.lzEndpointDstMock.address,
            1,
            2
        )

        this.lzEndpointSrcMock.setDestLzEndpoint(this.OmnichainNonFungibleTokenDst.address, this.lzEndpointDstMock.address)
        this.lzEndpointDstMock.setDestLzEndpoint(this.OmnichainNonFungibleTokenSrc.address, this.lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await this.OmnichainNonFungibleTokenSrc.setTrustedRemote(this.chainIdDst, this.OmnichainNonFungibleTokenDst.address) // for A, set B
        await this.OmnichainNonFungibleTokenDst.setTrustedRemote(this.chainIdSrc, this.OmnichainNonFungibleTokenSrc.address) // for B, set A
    })

    it("mint on the source chain and send ONFT to the destination chain", async function () {
        // mint OmnichainNonFungibleToken
        let tx = await this.OmnichainNonFungibleTokenSrc.mint();
        let onftTokenIdTemp = await ethers.provider.getTransactionReceipt(tx.hash)
        let onftTokenId = parseInt(Number(onftTokenIdTemp.logs[0].topics[3]));

        // verify the owner of the token is on the source chain
        let currentOwner = await this.OmnichainNonFungibleTokenSrc.ownerOf(onftTokenId)
        expect(currentOwner).to.be.equal(this.owner.address)

        // approve and send OmnichainNonFungibleToken
        await this.OmnichainNonFungibleTokenSrc.approve(this.OmnichainNonFungibleTokenSrc.address, onftTokenId)
        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        let adapterParam = ethers.utils.solidityPack(
            ['uint16','uint256'],
            [1, 225000]
        )
        await this.OmnichainNonFungibleTokenSrc.transferOmnichainNFT(this.chainIdDst, onftTokenId, adapterParam)

        // verify the owner of the token is no longer on the source chain
        await expect(this.OmnichainNonFungibleTokenSrc.ownerOf(onftTokenId)).to.revertedWith("ERC721: owner query for nonexistent token")

        // verify the owner of the token is on the destination chain
        currentOwner = await this.OmnichainNonFungibleTokenDst.ownerOf(onftTokenId)
        expect(currentOwner).to.not.equal(this.owner)

        // hit the max mint on the source chain
        await expect(this.OmnichainNonFungibleTokenSrc.mint()).to.revertedWith("ONFT: Max Mint limit reached")
    })
})