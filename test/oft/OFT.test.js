const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("OFT: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const name = "OmnichainFungibleToken"
    const symbol = "OFT"
    const globalSupply = ethers.utils.parseUnits("1000000", 18)

    let owner, lzEndpointSrcMock, lzEndpointDstMock, OFTSrc, OFTDst, LZEndpointMock, BasedOFT, OFT

    before(async function () {
        owner = (await ethers.getSigners())[0]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        BasedOFT = await ethers.getContractFactory("BasedOFT")
        OFT = await ethers.getContractFactory("OFT")
    })

    beforeEach(async function () {
        lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMock.deploy(chainIdDst)

        // create two OmnichainFungibleToken instances
        OFTSrc = await BasedOFT.deploy(name, symbol, lzEndpointSrcMock.address, globalSupply)
        OFTDst = await OFT.deploy(name, symbol, lzEndpointDstMock.address, globalSupply)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        lzEndpointSrcMock.setDestLzEndpoint(OFTDst.address, lzEndpointDstMock.address)
        lzEndpointDstMock.setDestLzEndpoint(OFTSrc.address, lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await OFTSrc.setTrustedRemote(chainIdDst, OFTDst.address) // for A, set B
        await OFTDst.setTrustedRemote(chainIdSrc, OFTSrc.address) // for B, set A
    })

    it("send() - burn local tokens on source chain and mint on destination chain", async function () {
        // ensure they're both starting from 1000000
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(globalSupply)
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal("0")

        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        // amount to be sent across
        const sendQty = ethers.utils.parseUnits("100", 18)

        // approve and send tokens
        await OFTSrc.approve(OFTSrc.address, sendQty)
        await OFTSrc.send(
            chainIdDst,
            ethers.utils.solidityPack(["address"], [owner.address]),
            sendQty,
            owner.address,
            ethers.constants.AddressZero,
            adapterParam
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(globalSupply.sub(sendQty))
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(sendQty)
    })
})
