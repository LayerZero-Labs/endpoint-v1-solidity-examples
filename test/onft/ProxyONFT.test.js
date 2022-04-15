const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("ProxyONFT: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const chainIdDst2 = 3
    const name = "OmnichainNonFungibleToken"
    const symbol = "ONFT"

    let owner, warlock, lzEndpointSrcMock, lzEndpointDstMock, lzEndpointDstMock2
    let ONFTDst, ONFTDst2, LZEndpointMock, ONFT, ERC721, ERC721Src, ProxyONFT, ProxyONFTSrc

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("ONFT")
        ProxyONFT = await ethers.getContractFactory("ProxyONFT")
        ERC721 = await ethers.getContractFactory("ERC721Mock")
    })

    beforeEach(async function () {
        lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMock.deploy(chainIdDst)
        lzEndpointDstMock2 = await LZEndpointMock.deploy(chainIdDst2)

        // make an ERC721 to mock a previous deploy
        ERC721Src = await ERC721.deploy("ERC721", "ERC721")
        // generate a proxy to allow it to go ONFT
        ProxyONFTSrc = await ProxyONFT.deploy(lzEndpointSrcMock.address, ERC721Src.address)

        // create ONFT on dstChains
        ONFTDst = await ONFT.deploy(name, symbol, lzEndpointDstMock.address)
        ONFTDst2 = await ONFT.deploy(name, symbol, lzEndpointDstMock2.address)

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointSrcMock.setDestLzEndpoint(ONFTDst.address, lzEndpointDstMock.address)
        lzEndpointSrcMock.setDestLzEndpoint(ONFTDst2.address, lzEndpointDstMock2.address)
        lzEndpointDstMock.setDestLzEndpoint(ProxyONFTSrc.address, lzEndpointSrcMock.address)
        lzEndpointDstMock.setDestLzEndpoint(ONFTDst2.address, lzEndpointDstMock2.address)
        lzEndpointDstMock2.setDestLzEndpoint(ProxyONFTSrc.address, lzEndpointSrcMock.address)
        lzEndpointDstMock2.setDestLzEndpoint(ONFTDst.address, lzEndpointDstMock.address)

        // set each contracts source address so it can send to each other
        await ProxyONFTSrc.setTrustedRemote(chainIdDst, ONFTDst.address)
        await ProxyONFTSrc.setTrustedRemote(chainIdDst2, ONFTDst2.address)
        await ONFTDst.setTrustedRemote(chainIdSrc, ProxyONFTSrc.address)
        await ONFTDst.setTrustedRemote(chainIdDst2, ONFTDst2.address)
        await ONFTDst2.setTrustedRemote(chainIdSrc, ProxyONFTSrc.address)
        await ONFTDst2.setTrustedRemote(chainIdDst, ONFTDst.address)
    })

    it("swap()", async function () {
        const tokenId = 123
        await ERC721Src.mint(owner.address, tokenId)

        // verify the owner of the token is on the source chain
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(owner.address)

        // token doesn't exist on other chain
        await expect(ONFTDst.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // can transfer token on srcChain as regular erC721
        await ERC721Src.transfer(warlock.address, tokenId)
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(warlock.address)

        // approve the proxy to swap your token
        await ERC721Src.connect(warlock).approve(ProxyONFTSrc.address, tokenId)
        // swaps token to other chain
        await ProxyONFTSrc.connect(warlock).send(chainIdDst, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is now owned by the proxy contract, because this is the original nft chain
        expect(await ERC721Src.ownerOf(tokenId)).to.equal(ProxyONFTSrc.address)

        // token received on the dst chain
        expect(await ONFTDst.ownerOf(tokenId)).to.be.equal(warlock.address)

        // can send to other onft contract eg. not the original nft contract chain
        await ONFTDst.connect(warlock).send(chainIdDst2, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(ONFTDst.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // token received on the dst chain
        expect(await ONFTDst2.ownerOf(tokenId)).to.be.equal(warlock.address)

        // send it back to the original chain
        await ONFTDst2.connect(warlock).send(chainIdSrc, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(ONFTDst2.ownerOf(tokenId)).to.be.revertedWith("ERC721: operator query for nonexistent token")

        // is received on the original chain
        expect(await ERC721Src.ownerOf(tokenId)).to.be.equal(warlock.address)
    })
})
