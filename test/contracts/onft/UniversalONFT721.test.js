const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("UniversalONFT721: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const name = "UniversalONFT"
    const symbol = "UONFT"
    const minGasToStore = 40000
    const batchSizeLimit = 1

    let owner, lzEndpointSrcMock, lzEndpointDstMock, ONFTSrc, ONFTDst, LZEndpointMock, ONFT, ONFTSrcIds, ONFTDstIds, dstPath, srcPath

    before(async function () {
        owner = (await ethers.getSigners())[0]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("UniversalONFT721")
        ONFTSrcIds = [1, 1] // [startID, endID]... only allowed to mint one ONFT
        ONFTDstIds = [2, 2] // [startID, endID]... only allowed to mint one ONFT
    })

    beforeEach(async function () {
        lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMock.deploy(chainIdDst)

        // create two UniversalONFT instances
        ONFTSrc = await ONFT.deploy(name, symbol, minGasToStore, lzEndpointSrcMock.address, ...ONFTSrcIds)
        ONFTDst = await ONFT.deploy(name, symbol, minGasToStore, lzEndpointDstMock.address, ...ONFTDstIds)

        lzEndpointSrcMock.setDestLzEndpoint(ONFTDst.address, lzEndpointDstMock.address)
        lzEndpointDstMock.setDestLzEndpoint(ONFTSrc.address, lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        dstPath = ethers.utils.solidityPack(["address", "address"], [ONFTDst.address, ONFTSrc.address])
        srcPath = ethers.utils.solidityPack(["address", "address"], [ONFTSrc.address, ONFTDst.address])
        await ONFTSrc.setTrustedRemote(chainIdDst, dstPath) // for A, set B
        await ONFTDst.setTrustedRemote(chainIdSrc, srcPath) // for B, set A

        // set batch size limit
        await ONFTSrc.setDstChainIdToBatchLimit(chainIdDst, batchSizeLimit)
        await ONFTDst.setDstChainIdToBatchLimit(chainIdSrc, batchSizeLimit)

        //set destination min gas
        await ONFTSrc.setMinDstGas(chainIdDst, parseInt(await ONFTSrc.FUNCTION_TYPE_SEND()), 225000)

        await ONFTSrc.setUseCustomAdapterParams(true)
    })

    it("sendFrom() - mint on the source chain and send ONFT to the destination chain", async function () {
        // mint ONFT
        const newId = await ONFTSrc.nextMintId()
        await ONFTSrc.mint()

        // verify the owner of the token is on the source chain
        expect(await ONFTSrc.ownerOf(newId)).to.be.equal(owner.address)

        // approve and send ONFT
        await ONFTSrc.approve(ONFTSrc.address, newId)
        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])

        // estimate nativeFees
        const nativeFee = (await ONFTSrc.estimateSendFee(chainIdDst, owner.address, newId, false, adapterParam)).nativeFee

        await ONFTSrc.sendFrom(
            owner.address,
            chainIdDst,
            owner.address,
            newId,
            owner.address,
            "0x000000000000000000000000000000000000dEaD",
            adapterParam,
            { value: nativeFee }
        )

        // verify the owner of the token is no longer on the source chain
        expect(await ONFTSrc.ownerOf(newId)).to.equal(ONFTSrc.address)

        // verify the owner of the token is on the destination chain
        expect(await ONFTDst.ownerOf(newId)).to.not.equal(owner)

        // hit the max mint on the source chain
        await expect(ONFTSrc.mint()).to.revertedWith("UniversalONFT721: max mint limit reached")
    })
})
