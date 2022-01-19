const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PingPong", function () {

    beforeEach(async function(){
        this.accounts = await ethers.getSigners();
        this.owner = this.accounts[0];
        this.alice = this.accounts[1];

        // use this chainId
        this.chainId = 123;

        // create a LayerZero Endpoint mock for testing
        const LayerZeroEndpointMock = await ethers.getContractFactory("LayerZeroEndpointMock");
        this.layerZeroEndpointMock = await LayerZeroEndpointMock.deploy();

        // create two PingPong instances
        const PingPong = await ethers.getContractFactory("PingPong");
        this.pingPongA = await PingPong.deploy(this.layerZeroEndpointMock.address);
        this.pingPongB = await PingPong.deploy(this.layerZeroEndpointMock.address);

        // create two MultiChainCounter instances
        const MultiChainToken = await ethers.getContractFactory("MultiChainToken");
        this.multiChainTokenA = await MultiChainToken.deploy("NAME1", "SYM1", this.layerZeroEndpointMock.address);

        const signer = await ethers.getSigner(impersonateAddr);

    });

    // it("increment the counter of the destination PingPong", async function () {

        // const tx = signer.sendTransaction({
        //     to: this.pingPongA.address,
        //     value: ethers.utils.parseEther("1.0")
        // });
        //
        // // ensure they're both starting from 100000000000000000000
        // let a = await this.pingPongA.balance;
        // let b = await this.pingPongB.balance;
        // let c = await this.owner.balance
        // expect(a).to.be.equal("0");
        // expect(b).to.be.equal("0");
        // expect(c).to.be.equal("100000000000000000000");

        // // approve and send tokens
        // await this.multiChainTokenA.approve(this.multiChainTokenA.address, "69420");
        // await this.multiChainTokenA.sendTokens(this.chainId, this.pingPongA.address, "69420")
        //
        // a = await this.multiChainTokenA.balanceOf(this.pingPongA.address);
        // b = await this.multiChainTokenA.balanceOf(this.pingPongB.address);
        // c = await this.multiChainTokenA.balanceOf(this.pingPongB.address);
        // expect(a).to.be.equal("69420");
        // expect(b).to.be.equal("0");
        // expect(c).to.be.equal("99999999999999930580");
        //
        // await this.pingPongA.connect(this.owner).ping(
        //     this.chainId,
        //     this.alice.address,
        //     0
        // );
        //
        // // verify tokens burned on chain a and minted on chain b
        // a = await this.pingPongA.balanceOf(this.owner.address);
        // b = await this.pingPongB.balanceOf(this.owner.address);
        // expect(a).to.be.equal("99999999999999930580");
        // expect(b).to.be.equal("100000000000000069420");
    // });
});
