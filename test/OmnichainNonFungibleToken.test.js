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
            "https://layerzero.network",
            this.lzEndpointSrcMock.address,
            0,
            50
        )
        this.OmnichainNonFungibleTokenDst = await OmnichainNonFungibleToken.deploy(
            "https://layerzero.network",
            this.lzEndpointDstMock.address,
            50,
            100
        )

        this.lzEndpointSrcMock.setDestLzEndpoint(this.OmnichainNonFungibleTokenDst.address, this.lzEndpointDstMock.address)
        this.lzEndpointDstMock.setDestLzEndpoint(this.OmnichainNonFungibleTokenSrc.address, this.lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await this.OmnichainNonFungibleTokenSrc.setTrustedSource(this.chainIdDst, this.OmnichainNonFungibleTokenDst.address) // for A, set B
        await this.OmnichainNonFungibleTokenDst.setTrustedSource(this.chainIdSrc, this.OmnichainNonFungibleTokenSrc.address) // for B, set A
    })

    it("mint on the source chain and send ONFT to the destination chain", async function () {
        // mint OmnichainNonFungibleToken
        await this.OmnichainNonFungibleTokenSrc.mint()
        // expected tokenId
        let onftTokenId = 1

        // verify the owner of the token is on the source chain
        let currentOwner = await this.OmnichainNonFungibleTokenSrc.ownerOf(onftTokenId)
        expect(currentOwner).to.be.equal(this.owner.address)

        // approve and send OmnichainNonFungibleToken
        await this.OmnichainNonFungibleTokenSrc.approve(this.OmnichainNonFungibleTokenSrc.address, onftTokenId)
        await this.OmnichainNonFungibleTokenSrc.transferOmnichainNFT(this.chainIdDst, onftTokenId)

        // verify the owner of the token is no longer on the source chain
        await expect(this.OmnichainNonFungibleTokenSrc.ownerOf(onftTokenId)).to.revertedWith("ERC721: owner query for nonexistent token")

        // verify the owner of the token is on the destination chain
        currentOwner = await this.OmnichainNonFungibleTokenDst.ownerOf(onftTokenId)
        expect(currentOwner).to.not.equal(this.owner)
    })
})
