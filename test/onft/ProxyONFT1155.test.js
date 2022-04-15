const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("ProxyONFT1155: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const chainId_C = 3
    const uri = "www.warlock.com"

    let owner, warlock, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC
    let ONFT_B, ONFT_C, LZEndpointMock, ONFT, ERC1155, ERC1155Src, ProxyONFT_A, ProxyONFT

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("ONFT1155")
        ProxyONFT = await ethers.getContractFactory("ProxyONFT1155")
        ERC1155 = await ethers.getContractFactory("ERC1155Mock")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
        lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)

        // make an ERC1155 to mock a previous deploy
        ERC1155Src = await ERC1155.deploy(uri)
        // // generate a proxy to allow it to go ONFT
        ProxyONFT_A = await ProxyONFT.deploy(lzEndpointMockA.address, ERC1155Src.address)

        // create ONFT on dstChains
        ONFT_B = await ONFT.deploy(uri, lzEndpointMockB.address)
        ONFT_C = await ONFT.deploy(uri, lzEndpointMockC.address)

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointMockA.setDestLzEndpoint(ONFT_B.address, lzEndpointMockB.address)
        lzEndpointMockA.setDestLzEndpoint(ONFT_C.address, lzEndpointMockC.address)
        lzEndpointMockB.setDestLzEndpoint(ProxyONFT_A.address, lzEndpointMockA.address)
        lzEndpointMockB.setDestLzEndpoint(ONFT_C.address, lzEndpointMockC.address)
        lzEndpointMockC.setDestLzEndpoint(ProxyONFT_A.address, lzEndpointMockA.address)
        lzEndpointMockC.setDestLzEndpoint(ONFT_B.address, lzEndpointMockB.address)

        // set each contracts source address so it can send to each other
        await ProxyONFT_A.setTrustedRemote(chainId_B, ONFT_B.address)
        await ProxyONFT_A.setTrustedRemote(chainId_C, ONFT_C.address)
        await ONFT_B.setTrustedRemote(chainId_A, ProxyONFT_A.address)
        await ONFT_B.setTrustedRemote(chainId_C, ONFT_C.address)
        await ONFT_C.setTrustedRemote(chainId_A, ProxyONFT_A.address)
        await ONFT_C.setTrustedRemote(chainId_B, ONFT_B.address)
    })

    it("send()", async function () {
        const tokenId = 123
        const amount = 1
        await ERC1155Src.mint(owner.address, tokenId, amount)

        // verify the owner owns tokens
        expect(await ERC1155Src.balanceOf(owner.address, tokenId)).to.be.equal(amount)

        // token doesn't exist on other chain
        expect(await ONFT_B.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // can transfer token on srcChain as regular erC1155
        await ERC1155Src.safeTransferFrom(owner.address, warlock.address, tokenId, amount, "0x")
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(amount)
        expect(await ERC1155Src.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // approve the proxy to swap your token
        await ERC1155Src.connect(warlock).setApprovalForAll(ProxyONFT_A.address, true)

        // swaps token to other chain
        await ProxyONFT_A.connect(warlock).send(chainId_B, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is now owned by the proxy contract, because this is the original nft chain
        expect(await ERC1155Src.balanceOf(ProxyONFT_A.address, tokenId)).to.be.equal(amount)
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // token received on the dst chain
        expect(await ONFT_B.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // can send to other onft contract eg. not the original nft contract chain
        await ONFT_B.connect(warlock).send(chainId_C, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        expect(await ONFT_B.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // token received on the dst chain
        expect(await ONFT_C.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // send it back to the original chain
        await ONFT_C.connect(warlock).send(chainId_A, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        expect(await ONFT_C.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // is received on the original chain
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // proxy no longer owns
        expect(await ERC1155Src.balanceOf(ProxyONFT_A.address, tokenId)).to.be.equal(0)
    })

    // todo
    it.skip("sendBatch()", async function () {

    })
})