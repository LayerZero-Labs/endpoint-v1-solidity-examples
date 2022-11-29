const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("OmniCounter", function () {
    beforeEach(async function () {
        // use this chainIds
        this.chainIdA = 101
        this.chainIdB = 102

        // create LayerZero Endpoints mock for testing
        const LayerZeroEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        this.lzEndpointMockA = await LayerZeroEndpointMock.deploy(this.chainIdA)
        this.lzEndpointMockB = await LayerZeroEndpointMock.deploy(this.chainIdB)

        // create two OmniCounter instances on separate chains
        const OmniCounter = await ethers.getContractFactory("OmniCounter")
        this.omniCounterA = await OmniCounter.deploy(this.lzEndpointMockA.address)
        this.omniCounterB = await OmniCounter.deploy(this.lzEndpointMockB.address)

        this.lzEndpointMockA.setDestLzEndpoint(this.omniCounterB.address, this.lzEndpointMockB.address)
        this.lzEndpointMockB.setDestLzEndpoint(this.omniCounterA.address, this.lzEndpointMockA.address)

        // set each contracts source address so it can send to each other
        this.omniCounterA.setTrustedRemote(
            this.chainIdB,
            ethers.utils.solidityPack(["address", "address"], [this.omniCounterB.address, this.omniCounterA.address])
        )
        this.omniCounterB.setTrustedRemote(
            this.chainIdA,
            ethers.utils.solidityPack(["address", "address"], [this.omniCounterA.address, this.omniCounterB.address])
        )
    })

    it("increment the counter of the destination OmniCounter", async function () {
        // ensure theyre both starting from 0
        expect(await this.omniCounterA.counter()).to.be.equal(0) // initial value
        expect(await this.omniCounterB.counter()).to.be.equal(0) // initial value

        // instruct each OmniCounter to increment the other OmniCounter
        // counter A increments counter B
        await this.omniCounterA.incrementCounter(this.chainIdB, { value: ethers.utils.parseEther("0.5") })
        expect(await this.omniCounterA.counter()).to.be.equal(0) // still 0
        expect(await this.omniCounterB.counter()).to.be.equal(1) // now its 1

        // counter B increments counter A
        await this.omniCounterB.incrementCounter(this.chainIdA, { value: ethers.utils.parseEther("0.5") })
        expect(await this.omniCounterA.counter()).to.be.equal(1) // now its 1
        expect(await this.omniCounterB.counter()).to.be.equal(1) // still 1
    })
})
