const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiChainCounter", function () {

    beforeEach(async function(){
        this.accounts = await ethers.getSigners();
        this.owner = this.accounts[0];

        // use this chainId
        this.chainId = 123;

        // create a LayerZero Endpoint mock for testing
        const LayerZeroEndpointMock = await ethers.getContractFactory("LayerZeroEndpointMock");
        this.layerZeroEndpointMock = await LayerZeroEndpointMock.deploy();

        // create two MultiChainCounter instances
        const MultiChainCounter = await ethers.getContractFactory("MultiChainCounter");
        this.multiChainCounterA = await MultiChainCounter.deploy(this.layerZeroEndpointMock.address);
        this.multiChainCounterB = await MultiChainCounter.deploy(this.layerZeroEndpointMock.address);
    });

    it("increment the counter of the destination MultiChainCounter", async function () {
        // ensure theyre both starting from 0
        expect(await this.multiChainCounterA.messageCounter()).to.be.equal(0); // initial value
        expect(await this.multiChainCounterB.messageCounter()).to.be.equal(0); // initial value

        // instruct each multiChainCounter to increment the other multiChainCounter
        // counter A increments counter B
        await this.multiChainCounterA.incrementCounter(
            this.chainId,
            this.multiChainCounterB.address,
        );
        expect(await this.multiChainCounterA.messageCounter()).to.be.equal(0); // still 0
        expect(await this.multiChainCounterB.messageCounter()).to.be.equal(1); // now its 1
        // counter B increments counter A
        await this.multiChainCounterB.incrementCounter(
            this.chainId,
            this.multiChainCounterA.address,
        );
        expect(await this.multiChainCounterA.messageCounter()).to.be.equal(1); // now its 1
        expect(await this.multiChainCounterB.messageCounter()).to.be.equal(1); // still 1

    });

});
