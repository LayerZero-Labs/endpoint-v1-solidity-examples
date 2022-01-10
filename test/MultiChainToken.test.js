const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiChainToken", function () {

    beforeEach(async function () {
        // this.accounts = await ethers.getSigners();
        // this.owner = this.accounts[0];

        // use this chainId
        this.chainId = 123;

        // create a LayerZero Endpoint mock for testing
        const LayerZeroEndpointMock = await ethers.getContractFactory("LayerZeroEndpointMock");
        this.layerZeroEndpointMock = await LayerZeroEndpointMock.deploy();

        // create two MultiChainCounter instances
        const MultiChainToken = await ethers.getContractFactory("MultiChainToken");
        this.multiChainTokenA = await MultiChainToken.deploy("NAME", "SYM", this.layerZeroEndpointMock.address);
        this.multiChainTokenB = await MultiChainToken.deploy("NAME", "SYM", this.layerZeroEndpointMock.address);
    });

    it("burn local tokens on chain a and mint on chain b", async function () {
        // let a = await this.multiChainTokenA.balanceOf(this.multiChainTokenA.address);
        // let b = await this.multiChainTokenB.balanceOf(this.multiChainTokenB.address);
        await this.multiChainTokenA.approve(this.multiChainTokenA.address, "1000000000");
        await this.multiChainTokenA.sendTokens(this.chainId, this.multiChainTokenB.address, "1000000000")
        let b = await this.multiChainTokenB.balanceOf(this.multiChainTokenB.address);
        // expect(b).to.be.equal("1000000000");
    });
});
