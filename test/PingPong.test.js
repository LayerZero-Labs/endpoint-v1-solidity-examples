const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("PingPong", function () {
    beforeEach(async function () {
        this.accounts = await ethers.getSigners()
        this.owner = this.accounts[0]

        // use this chainId
        this.chainId = 123

        // create a LayerZero Endpoint mock for testing
        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        this.layerZeroEndpointMock = await LZEndpointMock.deploy(this.chainId)
        this.mockEstimatedNativeFee = ethers.utils.parseEther("0.001")
        this.mockEstimatedZroFee = ethers.utils.parseEther("0.00025")
        await this.layerZeroEndpointMock.setEstimatedFees(this.mockEstimatedNativeFee, this.mockEstimatedZroFee)

        // create two PingPong instances
        const PingPong = await ethers.getContractFactory("PingPong")
        this.pingPongA = await PingPong.deploy(this.layerZeroEndpointMock.address)
        this.pingPongB = await PingPong.deploy(this.layerZeroEndpointMock.address)

        await this.owner.sendTransaction({
            to: this.pingPongA.address,
            value: ethers.utils.parseEther("0.0001"),
        })
        await this.owner.sendTransaction({
            to: this.pingPongB.address,
            value: ethers.utils.parseEther("0.0001"),
        })
    })

    it("increment the counter of the destination PingPong", async function () {
        expect(await this.pingPongA.numPings()).to.equal(0)
        expect(await this.pingPongB.numPings()).to.equal(0)
        // await this.pingPongA.ping(this.chainId, this.pingPongB.address, 0);
    })
})
