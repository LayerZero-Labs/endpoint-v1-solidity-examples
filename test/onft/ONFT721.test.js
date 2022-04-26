const { expect } = require("chai")
const { ethers } = require("hardhat")

describe.skip("ONFT721: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const name = "OmnichainNonFungibleToken"
    const symbol = "ONFT"

    let owner, lzEndpointSrcMock, lzEndpointDstMock, ONFTSrc, ONFTDst, LZEndpointMock, ONFT

    before(async function () {
        owner = (await ethers.getSigners())[0]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("ONFT721")
    })

    beforeEach(async function () {
        lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMock.deploy(chainIdDst)

        // create two ONFT instances
        ONFTSrc = await ONFT.deploy(name, symbol, lzEndpointSrcMock.address)
        ONFTDst = await ONFT.deploy(name, symbol, lzEndpointDstMock.address)

        lzEndpointSrcMock.setDestLzEndpoint(ONFTDst.address, lzEndpointDstMock.address)
        lzEndpointDstMock.setDestLzEndpoint(ONFTSrc.address, lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await ONFTSrc.setTrustedRemote(chainIdDst, ONFTDst.address) // for A, set B
        await ONFTDst.setTrustedRemote(chainIdSrc, ONFTSrc.address) // for B, set A
    })

    it("todo", async function () {
        // todo
    })
})
