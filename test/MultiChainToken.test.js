const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiChainToken", function () {

    beforeEach(async function () {
        this.accounts = await ethers.getSigners();
        this.owner = this.accounts[0];

        // use this chainId
        this.chainId = 123;

        // create a LayerZero Endpoint mock for testing
        const LayerZeroEndpointMock = await ethers.getContractFactory("LayerZeroEndpointMock");
        this.layerZeroEndpointMock = await LayerZeroEndpointMock.deploy();

        // create two MultiChainCounter instances
        const MultiChainToken = await ethers.getContractFactory("MultiChainToken");
        this.multiChainTokenA = await MultiChainToken.deploy("NAME1", "SYM1", this.layerZeroEndpointMock.address);
        this.multiChainTokenB = await MultiChainToken.deploy("NAME2", "SYM2", this.layerZeroEndpointMock.address);

        // retrieve the starting tokens
        this.startingTokens = await this.multiChainTokenA.balanceOf(this.owner.address);
    });

    it("burn local tokens on chain a and mint on chain b", async function () {
        // ensure they're both starting from 100000000000000000000
        let a = await this.multiChainTokenA.balanceOf(this.owner.address);
        let b = await this.multiChainTokenB.balanceOf(this.owner.address);
        expect(a).to.be.equal(this.startingTokens);
        expect(b).to.be.equal(this.startingTokens);

        //approve and send tokens
        let sendQty = ethers.utils.parseUnits("100", 18)
        await this.multiChainTokenA.approve(this.multiChainTokenA.address, sendQty);
        await this.multiChainTokenA.sendTokens(this.chainId, this.multiChainTokenB.address, sendQty)

        //verify tokens burned on chain a and minted on chain b
        a = await this.multiChainTokenA.balanceOf(this.owner.address);
        b = await this.multiChainTokenB.balanceOf(this.owner.address);
        expect(a).to.be.equal(this.startingTokens.sub(sendQty));
        expect(b).to.be.equal(this.startingTokens.add(sendQty));
    });
});
