const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("DistributeONFT721: ", function () {
    const chainIdA = 1
    const chainIdB = 2
    const chainIdC = 3
    const name = "DistributeONFT"
    const symbol = "UONFT"

    let owner, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC, distributeONFT721A, receiveONFT721B, receiveONFT721C, LZEndpointMock, DistributeONFT721,ReceiveONFT721, ONFTSrcIds, ONFTDstIds, LzLibFactory, lzLib

    before(async function () {
        owner = (await ethers.getSigners())[0]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        DistributeONFT721 = await ethers.getContractFactory("DistributeONFT721")
        ReceiveONFT721 = await ethers.getContractFactory("ReceiveONFT721")
        // ONFTSrcIds = [1, 1] // [startID, endID]... only allowed to mint one ONFT
        // ONFTDstIds = [2, 2] // [startID, endID]... only allowed to mint one ONFT
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainIdA)
        lzEndpointMockB = await LZEndpointMock.deploy(chainIdB)
        lzEndpointMockC = await LZEndpointMock.deploy(chainIdC)

        // create two DistributeONFT instances
        distributeONFT721A = await DistributeONFT721.deploy(name, symbol, lzEndpointMockA.address)
        receiveONFT721B = await ReceiveONFT721.deploy(name, symbol, lzEndpointMockB.address)
        receiveONFT721C = await ReceiveONFT721.deploy(name, symbol, lzEndpointMockC.address)

        lzEndpointMockA.setDestLzEndpoint(receiveONFT721B.address, lzEndpointMockB.address)
        lzEndpointMockB.setDestLzEndpoint(distributeONFT721A.address, lzEndpointMockA.address)

        lzEndpointMockA.setDestLzEndpoint(receiveONFT721C.address, lzEndpointMockC.address)
        lzEndpointMockC.setDestLzEndpoint(distributeONFT721A.address, lzEndpointMockA.address)

        lzEndpointMockC.setDestLzEndpoint(receiveONFT721B.address, lzEndpointMockB.address)
        lzEndpointMockB.setDestLzEndpoint(receiveONFT721C.address, lzEndpointMockC.address)

        // set each contracts source address so it can send to each other
        await distributeONFT721A.setTrustedRemote(chainIdB, receiveONFT721B.address) // for A, set B
        await receiveONFT721B.setTrustedRemote(chainIdA, distributeONFT721A.address) // for B, set A

        await distributeONFT721A.setTrustedRemote(chainIdC, receiveONFT721C.address) // for A, set B
        await receiveONFT721C.setTrustedRemote(chainIdA, distributeONFT721A.address) // for B, set A

        await receiveONFT721C.setTrustedRemote(chainIdB, receiveONFT721B.address) // for A, set B
        await receiveONFT721B.setTrustedRemote(chainIdC, receiveONFT721C.address) // for B, set A
    })

    it("mint() - with no available token id's should revert.", async function () {
        await expect(distributeONFT721A.mint()).to.revertedWith("ONFT721: max mint limit reached")
    })

    it("sendFrom() - mint on the source chain and send ONFT to the destination chain", async function () {
        await expect(distributeONFT721A.mint()).to.revertedWith("ONFT721: max mint limit reached")

        await distributeONFT721A.distribute(chainIdA, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        await distributeONFT721A.distribute(chainIdB, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        const newId = 0;
        await distributeONFT721A.mint()

        // verify the owner of the token is on the source chain
        expect(await distributeONFT721A.ownerOf(newId)).to.be.equal(owner.address)

        // approve and send ONFT
        await distributeONFT721A.approve(distributeONFT721A.address, newId)
        // v1 adapterParams, encoded for version 1 style, and 200k gas quote
        // const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])

        await distributeONFT721A["sendFrom(address,uint16,bytes,uint256,address,address,bytes)"](
            owner.address,
            chainIdB,
            owner.address,
            newId,
            owner.address,
            "0x000000000000000000000000000000000000dEaD",
            "0x"
            // adapterParam
        )

        // verify the owner of the token is no longer on the source chain
        expect(await distributeONFT721A.ownerOf(newId)).to.equal(distributeONFT721A.address)

        // verify the owner of the token is on the destination chain
        expect(await receiveONFT721B.ownerOf(newId)).to.not.equal(owner)

        // hit the max mint on the source chain
        await expect(distributeONFT721A.mint()).to.revertedWith("ONFT721: max mint limit reached")

        await receiveONFT721B["sendFrom(address,uint16,bytes,uint256,address,address,bytes)"](
            owner.address,
            chainIdA,
            owner.address,
            newId,
            owner.address,
            "0x000000000000000000000000000000000000dEaD",
            "0x"
            // adapterParam
        )

        // verify the owner of the token is on the destination chain
        expect(await receiveONFT721B.ownerOf(newId)).to.equal(receiveONFT721B.address)

        // verify the owner of the token is no longer on the source chain
        expect(await distributeONFT721A.ownerOf(newId)).to.equal(owner.address)
    })

    it("sendFrom() - mint on the source chain and send ONFT to the destination chain", async function () {
        await expect(receiveONFT721B.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(0)

        await distributeONFT721A.distribute(chainIdB, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(1)

        const newId = 0;
        await receiveONFT721B.mint()

        // verify the owner of the token is on the source chain
        expect(await receiveONFT721B.ownerOf(newId)).to.be.equal(owner.address)

        // hit the max mint on the source chain
        await expect(receiveONFT721B.mint()).to.revertedWith("ONFT721: max mint limit reached")
    })

    it("distribute() - to three chains", async function () {
        await expect(distributeONFT721A.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(0)

        await expect(receiveONFT721B.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(0)

        await expect(receiveONFT721C.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(0)

        await distributeONFT721A.distribute(chainIdA, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(1)
        expect(JSON.stringify((await distributeONFT721A.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([0]))

        await distributeONFT721A.distribute(chainIdB, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(1)
        expect(JSON.stringify((await receiveONFT721B.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([1]))

        await distributeONFT721A.distribute(chainIdC, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(1)
        expect(JSON.stringify((await receiveONFT721C.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([2]))

        await distributeONFT721A.mint()
        await receiveONFT721B.mint()
        await receiveONFT721C.mint()

        await expect(distributeONFT721A.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(0)

        await expect(receiveONFT721B.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(0)

        await expect(receiveONFT721C.mint()).to.revertedWith("ONFT721: max mint limit reached")
        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(0)

        await distributeONFT721A.distribute(chainIdA, 3, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(3)
        expect(JSON.stringify((await distributeONFT721A.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([3,4,5]))

        await distributeONFT721A.distribute(chainIdB, 2, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(2)
        expect(JSON.stringify((await receiveONFT721B.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([6,7]))

        await distributeONFT721A.distribute(chainIdC, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(1)
        expect(JSON.stringify((await receiveONFT721C.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([8]))

        await distributeONFT721A.distribute(chainIdA, 1, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(4)
        expect(JSON.stringify((await distributeONFT721A.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([3,4,5,9]))

        await distributeONFT721A.distribute(chainIdB, 2, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(4)
        expect(JSON.stringify((await receiveONFT721B.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([6,7,10,11]))

        await distributeONFT721A.distribute(chainIdC, 3, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")
        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(4)
        expect(JSON.stringify((await receiveONFT721C.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([8,12,13,14]))

        await distributeONFT721A.mint()
        await receiveONFT721B.mint()
        await receiveONFT721C.mint()

        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(3)
        expect(JSON.stringify((await distributeONFT721A.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([4,5,9]))

        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(3)
        expect(JSON.stringify((await receiveONFT721B.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([7,10,11]))

        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(3)
        expect(JSON.stringify((await receiveONFT721C.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([12,13,14]))

        await expect(distributeONFT721A.redistribute(chainIdC, 4, owner.address, "0x000000000000000000000000000000000000dEaD", "0x"))
            .to.revertedWith("DistributeONFT: amount must be greater than the current amount left.")

        await expect(distributeONFT721A.redistribute(chainIdA, 3, owner.address, "0x000000000000000000000000000000000000dEaD", "0x"))
            .to.revertedWith("DistributeONFT: Cannot redistribute to own chain.")

        await distributeONFT721A.redistribute(chainIdC, 3, owner.address, "0x000000000000000000000000000000000000dEaD", "0x")

        expect(parseInt(await distributeONFT721A.tokenIdsLeft())).to.be.equal(0)
        expect(JSON.stringify((await distributeONFT721A.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([]))

        expect(parseInt(await receiveONFT721B.tokenIdsLeft())).to.be.equal(3)
        expect(JSON.stringify((await receiveONFT721B.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([7,10,11]))

        expect(parseInt(await receiveONFT721C.tokenIdsLeft())).to.be.equal(6)
        expect(JSON.stringify((await receiveONFT721C.getTokenIdsLeft()).map(x => parseInt(x)))).to.be.equal(JSON.stringify([12,13,14,4,5,9]))
    })
})

