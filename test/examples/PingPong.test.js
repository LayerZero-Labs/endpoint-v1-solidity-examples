const { expect } = require("chai")
const { ethers } = require("hardhat")

// fund "to" address by "value" from "signer"
const fund = async (signer, to, value) => {
    ;(
        await signer.sendTransaction({
            to,
            value,
        })
    ).wait()
}

describe("PingPong", async function () {
    const chainIdA = 1
    const chainIdB = 2
    // amount to fund each PingPong instance
    const pingPongBalance = ethers.utils.parseEther(".1")
    const gasForDstLzReceive = 350000

    let LZEndpointMock, layerZeroEndpointMockA, layerZeroEndpointMockB
    let PingPong, pingPongA, pingPongB
    let owner

    before(async function () {
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        PingPong = await ethers.getContractFactory("PingPong")
        owner = (await ethers.getSigners())[0]
    })

    beforeEach(async function () {
        layerZeroEndpointMockA = await LZEndpointMock.deploy(chainIdA)
        layerZeroEndpointMockB = await LZEndpointMock.deploy(chainIdB)

        // create two PingPong contract instances and provide native token balance
        pingPongA = await PingPong.deploy(layerZeroEndpointMockA.address)
        await fund(owner, pingPongA.address, pingPongBalance)
        pingPongB = await PingPong.deploy(layerZeroEndpointMockB.address)
        await fund(owner, pingPongB.address, pingPongBalance)

        await layerZeroEndpointMockA.setDestLzEndpoint(pingPongB.address, layerZeroEndpointMockB.address)
        await layerZeroEndpointMockB.setDestLzEndpoint(pingPongA.address, layerZeroEndpointMockA.address)

        // enable bidirectional communication between pingPongA and pingPongB
        await pingPongA.setTrustedRemote(chainIdB, ethers.utils.solidityPack(["address", "address"], [pingPongB.address, pingPongA.address])) // for A, set B
        await pingPongB.setTrustedRemote(chainIdA, ethers.utils.solidityPack(["address", "address"], [pingPongA.address, pingPongB.address])) // for B, set A
    })

    it("ping back and forth once between PingPong contract instances", async function () {
        const startBalanceA = await ethers.provider.getBalance(pingPongA.address)
        const startBalanceB = await ethers.provider.getBalance(pingPongB.address)

        // Send one ping from A->B, then one pong back from B->A.  Validate B emits a ping with count=1.
        await expect(pingPongA.ping(chainIdB, 2)).to.emit(pingPongB, "Ping").withArgs(1)

        // Ensure pingPongA has emitted exactly one Ping with count=2 and no MessageFailed events.
        const aPings = await pingPongA.queryFilter(pingPongA.filters.Ping(), 0, "latest")
        expect(aPings.length).to.equal(1)
        // waffle 3 is incapable of expect'ing multiple emits.
        expect(pingPongA.interface.decodeEventLog("Ping", aPings[0].data).pingCount).to.equal(2)
        expect((await pingPongA.queryFilter(pingPongA.filters.MessageFailed(), 0, "latest")).length).to.equal(0)

        // Ensure pingPongB has emitted one Ping and no MessageFailed events.
        expect((await pingPongB.queryFilter(pingPongB.filters.Ping(), 0, "latest")).length).to.equal(1)
        expect((await pingPongB.queryFilter(pingPongB.filters.MessageFailed(), 0, "latest")).length).to.equal(0)

        // Ensure PingPong contract balances have decreased.
        expect(await ethers.provider.getBalance(pingPongA.address)).to.be.lt(startBalanceA.sub(gasForDstLzReceive))
        expect(await ethers.provider.getBalance(pingPongB.address)).to.be.lt(startBalanceB.sub(gasForDstLzReceive))
    })
})
