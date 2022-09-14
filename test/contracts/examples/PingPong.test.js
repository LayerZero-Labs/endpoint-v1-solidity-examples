const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("PingPong", function () {
    beforeEach(async function () {
        this.accounts = await ethers.getSigners()
        this.owner = this.accounts[0]

        // use this chainId
        this.chainIdSrc = 1
        this.chainIdDst = 2

        // create a LayerZero Endpoint mock for testing
        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        this.layerZeroEndpointMockSrc = await LZEndpointMock.deploy(this.chainIdSrc)
        this.layerZeroEndpointMockDst = await LZEndpointMock.deploy(this.chainIdDst)

        // create two PingPong instances
        const PingPong = await ethers.getContractFactory("PingPong")
        this.pingPongA = await PingPong.deploy(this.layerZeroEndpointMockSrc.address)
        this.pingPongB = await PingPong.deploy(this.layerZeroEndpointMockDst.address)

        this.layerZeroEndpointMockSrc.setDestLzEndpoint(this.pingPongB.address, this.layerZeroEndpointMockDst.address)
        this.layerZeroEndpointMockDst.setDestLzEndpoint(this.pingPongA.address, this.layerZeroEndpointMockSrc.address)

        // set each contracts source address so it can send to each other
        await this.pingPongA.setTrustedRemote(this.chainIdDst, ethers.utils.solidityPack(["address", "address"], [this.pingPongB.address, this.pingPongA.address])) // for A, set B
        await this.pingPongB.setTrustedRemote(this.chainIdSrc, ethers.utils.solidityPack(["address", "address"], [this.pingPongA.address, this.pingPongB.address])) // for B, set A

        await this.pingPongA.enable(true)
        await this.pingPongB.enable(true)
    })

    it("increment the counter of the destination PingPong when paused should revert", async function () {
        await expect(this.pingPongA.ping(this.chainIdDst, this.pingPongB.address, 0)).to.revertedWith("Pausable: paused")
    })

    it("increment the counter of the destination PingPong when unpaused show not revert", async function () {
        await this.pingPongA.enable(false)
        await this.pingPongB.enable(false)
        await this.pingPongA.ping(this.chainIdDst, this.pingPongB.address, 0, {value: ethers.utils.parseEther("0.5")})
    })
})
