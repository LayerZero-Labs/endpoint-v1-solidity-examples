const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("ProxyONFT721: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const chainId_C = 3
    const name = "OmnichainNonFungibleToken"
    const symbol = "ONFT"

    let owner, warlock, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC
    let ONFT_B, ONFT_C, LZEndpointMock, ONFT, ERC721, ERC721Src, ProxyONFT_A, ProxyONFT

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("ONFT721")
        ProxyONFT = await ethers.getContractFactory("ProxyONFT721")
        ERC721 = await ethers.getContractFactory("ERC721Mock")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
        lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)

        // make an ERC721 to mock a previous deploy
        ERC721Src = await ERC721.deploy("ERC721", "ERC721")
        // generate a proxy to allow it to go ONFT
        ProxyONFT_A = await ProxyONFT.deploy(lzEndpointMockA.address, ERC721Src.address)

        // create ONFT on dstChains
        ONFT_B = await ONFT.deploy(name, symbol, lzEndpointMockB.address)
        ONFT_C = await ONFT.deploy(name, symbol, lzEndpointMockC.address)

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

    it.skip("send()", async function () {
        const tokenId = 123
        await ERC721Src.mint(owner.address, tokenId)

        // verify the owner of the token is on the source chain
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(owner.address)

        // token doesn't exist on other chain
        await expect(ONFT_B.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // can transfer token on srcChain as regular erC721
        await ERC721Src.transfer(warlock.address, tokenId)
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(warlock.address)

        // approve the proxy to swap your token
        await ERC721Src.connect(warlock).approve(ProxyONFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyONFT_A.connect(warlock).send(chainId_B, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is now owned by the proxy contract, because this is the original nft chain
        expect(await ERC721Src.ownerOf(tokenId)).to.equal(ProxyONFT_A.address)

        // token received on the dst chain
        expect(await ONFT_B.ownerOf(tokenId)).to.be.equal(warlock.address)

        // can send to other onft contract eg. not the original nft contract chain
        await ONFT_B.connect(warlock).send(chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(ONFT_B.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // token received on the dst chain
        expect(await ONFT_C.ownerOf(tokenId)).to.be.equal(warlock.address)

        // send it back to the original chain
        await ONFT_C.connect(warlock).send(chainId_A, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(ONFT_C.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // is received on the original chain
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(warlock.address)
    })
})
